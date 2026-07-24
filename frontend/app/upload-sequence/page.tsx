"use client";

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Dna,
  Scissors,
  BookOpen,
  Syringe,
  Zap,
  Shield,
  Thermometer,
  Target,
  BarChart3,
  Star,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { ValidationReport, AnalysisReport } from "@/types/upload";
import { Modality } from "@/types/upload";
import type { AnalyzeResponse } from "@/types/upload-types";
import { validateSequence, analyzeSequence } from "@/lib/uploadApi";
import SequenceTrackViewer from "@/components/SequenceTrackViewer";
import GcContentChart from "@/components/GcContentChart";
import NucleotideCompositionChart from "@/components/NucleotideCompositionChart";
import ExportMenu from "@/components/ExportMenu";

type Step = "upload" | "validate" | "modality" | "analysis";

const MODALITIES = [
  {
    id: "aso",
    name: "ASO / Splice Switching",
    icon: Scissors,
    color: "indigo",
    description: "Exon skipping/inclusion or RNase H-mediated degradation.",
  },
  {
    id: "sirna",
    name: "siRNA / shRNA Design",
    icon: Zap,
    color: "emerald",
    description: "Target knock-down via RISC pathway.",
  },
  {
    id: "mrna",
    name: "mRNA Design / Optimization",
    icon: BookOpen,
    color: "blue",
    description: "Codon optimization, UTR selection, and nucleoside modification.",
  },
  {
    id: "sgrna",
    name: "sgRNA / CRISPR Targeting",
    icon: Target,
    color: "purple",
    description: "Off-target analysis and guide selection.",
  },
];

export default function UploadSequencePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rawInput, setRawInput] = useState("");
  const [filename, setFilename] = useState<string | undefined>();
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [selectedModality, setSelectedModality] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecs, setExpandedRecs] = useState<Record<string, boolean>>({});

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawInput(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawInput(text);
    };
    reader.readAsText(file);
  }, []);

  function clientSideValidate(raw: string, fname?: string) {
    const seq = raw.replace(/^>.*$/gm, "").replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!seq) return null;
    const hasT = seq.includes("T");
    const hasU = seq.includes("U");
    const seqType = hasT && !hasU ? "dna" : hasU && !hasT ? "rna" : "dna";
    const gc = seq.length > 0 ? Math.round((seq.split("").filter((b) => "GC".includes(b)).length / seq.length) * 1000) / 10 : 0;
    const invalid = [...new Set(seq.split("").filter((b) => !"ACGTRYSWKMBDHVN".includes(b)))].sort();
    const isRna = hasU && !hasT;
    const startCodons = isRna ? ["AUG"] : ["ATG"];
    const stopCodons = isRna ? ["UAA", "UAG", "UGA"] : ["TAA", "TAG", "TGA"];
    const orfs: { strand: string; frame: number; start: number; end: number; length: number; proteinLength: number }[] = [];
    function revComp(s: string): string {
      const comp: Record<string, string> = isRna
        ? { A: "U", U: "A", G: "C", C: "G" }
        : { A: "T", T: "A", G: "C", C: "G" };
      return s.split("").reverse().map((b) => comp[b] ?? "N").join("");
    }
    function scanOrfs(s: string, strand: string) {
      for (let frame = 0; frame < 3; frame++) {
        let i = frame;
        while (i < s.length - 2) {
          const codon = s.slice(i, i + 3);
          if (startCodons.includes(codon)) {
            const start = i;
            let j = i + 3;
            while (j < s.length - 2) {
              if (stopCodons.includes(s.slice(j, j + 3))) {
                orfs.push({ strand, frame: frame + 1, start: start + 1, end: j + 3, length: j + 3 - start, proteinLength: (j - start) / 3 });
                break;
              }
              j += 3;
            }
            i = j + 3 < s.length ? j + 3 : s.length;
          } else {
            i += 3;
          }
        }
      }
    }
    scanOrfs(seq, "+");
    scanOrfs(revComp(seq), "-");
    const features: string[] = [];
    if (/A{6,}$/.test(seq)) features.push("Poly-A tail detected");
    if (/G{4,}/.test(seq)) features.push("Poly-G tract detected");
    if (orfs.length > 0) {
      const best = orfs.reduce((a, b) => (b.proteinLength > a.proteinLength ? b : a));
      features.push(`Longest ORF: ${best.proteinLength} aa (${best.strand} strand, frame ${best.frame})`);
    }
    return {
      valid: invalid.length === 0,
      sequence: seq,
      sequenceType: seqType as "dna" | "rna",
      length: seq.length,
      gcContent: gc,
      invalidChars: invalid,
      features,
      orfs,
      filename: fname,
      hasPolyA: /A{6,}$/.test(seq),
      hasPolyG: /G{4,}/.test(seq),
    };
  }

  function clientSideAnalyze(seq: string, modality: string) {
    const gc = seq.length > 0 ? Math.round((seq.split("").filter((b) => "GC".includes(b)).length / seq.length) * 1000) / 10 : 0;
    const length = seq.length;
    const offRisk = length < 18 ? "High" : length < 20 ? "Medium" : "Low";
    const k = 6;
    const kmers = length >= k ? Array.from({ length: length - k + 1 }, (_, i) => seq.slice(i, i + k)) : [];
    const repetitiveness = kmers.length > 0 ? 1 - new Set(kmers).size / kmers.length : 0;

    // Palindrome positions
    const palindromePositions: number[] = [];
    for (let i = 0; i < length - 5; i++) {
      const chunk = seq.slice(i, i + 6);
      if (chunk === chunk.split("").reverse().join("")) palindromePositions.push(i + 1);
    }
    const palindromes = palindromePositions.length;
    const mfe = Math.round((gc / 100 * -1.5 + (100 - gc) / 100 * -0.9) * length / 2 * 10) / 10;

    const hasT = seq.includes("T");
    const hasU = seq.includes("U");
    const seqType = hasT && !hasU ? "dna" : hasU && !hasT ? "rna" : "dna";

    // Immune hits with positions
    const immune: { motif: string; label: string; start: number; end: number }[] = [];
    const guRichRe = /[GU]{2,}U[GU]{2,}/gi;
    let m;
    while ((m = guRichRe.exec(seq)) !== null && immune.length < 40) {
      immune.push({ motif: m[0], label: "GU-rich stretch (literature-associated with TLR7/8 sensing; not a confirmed motif)", start: m.index + 1, end: m.index + m[0].length });
    }
    const homoRe = /(.)\1{3,}/g;
    while ((m = homoRe.exec(seq)) !== null && immune.length < 40) {
      immune.push({ motif: m[0].slice(0, 6), label: "Homopolymer run (4+ repeats; general repetitive-element flag)", start: m.index + 1, end: m.index + m[0].length });
    }
    if (seqType === "dna") {
      const cpgRe = /[AG][AG]CG[CT][CT]/gi;
      while ((m = cpgRe.exec(seq)) !== null && immune.length < 40) {
        immune.push({ motif: m[0], label: "Unmethylated CpG in a purine-purine-CG-pyrimidine-pyrimidine context (literature TLR9 motif pattern; not a confirmed assay)", start: m.index + 1, end: m.index + m[0].length });
      }
    }

    // ORFs (both strands)
    const orfs: { strand: string; frame: number; start: number; end: number; length: number; proteinLength: number }[] = [];
    const isRna = hasU && !hasT;
    const startCodons = isRna ? ["AUG"] : ["ATG"];
    const stopCodons = isRna ? ["UAA", "UAG", "UGA"] : ["TAA", "TAG", "TGA"];
    function revComp(s: string): string {
      const comp: Record<string, string> = isRna ? { A: "U", U: "A", G: "C", C: "G" } : { A: "T", T: "A", G: "C", C: "G" };
      return s.split("").reverse().map((b) => comp[b] ?? "N").join("");
    }
    function scanOrfs(s: string, strand: string) {
      for (let frame = 0; frame < 3; frame++) {
        let i = frame;
        while (i < s.length - 2) {
          if (startCodons.includes(s.slice(i, i + 3))) {
            const start = i;
            let j = i + 3;
            while (j < s.length - 2) {
              if (stopCodons.includes(s.slice(j, j + 3))) {
                orfs.push({ strand, frame: frame + 1, start: start + 1, end: j + 3, length: j + 3 - start, proteinLength: (j - start) / 3 });
                break;
              }
              j += 3;
            }
            i = j + 3 < s.length ? j + 3 : s.length;
          } else { i += 3; }
        }
      }
    }
    scanOrfs(seq, "+");
    scanOrfs(revComp(seq), "-");

    // GC sliding window
    const windowSize = 10;
    const step = 2;
    const gcCurve: { position: number; gc: number }[] = [];
    for (let i = 0; i <= length - windowSize; i += step) {
      const chunk = seq.slice(i, i + windowSize);
      const gcCount = chunk.split("").filter((b) => "GC".includes(b)).length;
      gcCurve.push({ position: i + 1, gc: Math.round((gcCount / windowSize) * 1000) / 10 });
    }

    // Nucleotide composition
    const composition = { A: (seq.match(/A/g) || []).length, C: (seq.match(/C/g) || []).length, G: (seq.match(/G/g) || []).length, T: (seq.match(/T/g) || []).length, U: (seq.match(/U/g) || []).length };

    const offNote = offRisk === "Low" ? "Adequate length for specificity in general, not verified against any genome" : offRisk === "Medium" ? "Moderate length — not verified against any genome" : "Short sequence — generally correlates with higher off-target probability, not verified against any genome";
    const modRecs: string[] = [];
    let modDetails: Record<string, unknown> = { recommendations: modRecs };
    if (modality === "aso") {
      if (gc < 30) modRecs.push("Low GC% — consider LNA or 2'-OMe modifications to boost Tm");
      else if (gc > 70) modRecs.push("High GC% — risk of G-quadruplexes; consider shorter ASO");
      else modRecs.push("GC content in optimal range for RNase H recruitment");
      if (length < 15) modRecs.push("Very short — high off-target risk; minimum 18 nt recommended");
      else if (length > 25) modRecs.push("Long ASO — may have reduced cellular uptake; consider gapmer design");
      modDetails = { ...modDetails, recommendedChemistry: gc >= 35 ? "gapmer" : "pmo", optimalLength: "18-22 nt", targetRegion: "Exon junction or mutated region recommended" };
    } else if (modality === "sirna") {
      if (length < 19 || length > 25) modRecs.push("Optimal siRNA length is 19-25 nt");
      if (gc < 30 || gc > 52) modRecs.push("Optimal GC content for siRNA is 30-52%");
      modRecs.push("Guide strand + Passenger strand design");
      modDetails = { ...modDetails, strand: "Guide strand (antisense) + Passenger strand", optimalLength: "21 nt with 2-nt 3' overhangs" };
    } else if (modality === "mrna") {
      modRecs.push("Consider 5' Cap analog (Anti-Reverse Cap ARCA)");
      modRecs.push("Evaluate codon optimization for human expression");
      if (!/A{6,}$/.test(seq)) modRecs.push("Add 100-150 nt poly(A) for stability");
      modDetails = { ...modDetails, needsCodonOptimization: true, needsPolyA: !/A{6,}$/.test(seq), needsUTR: true, nucleosideModifications: ["N1-methylpseudouridine (m1Ψ)", "5-methylcytidine (m5C)"] };
    } else if (modality === "sgrna") {
      if (length < 17 || length > 21) modRecs.push("Optimal sgRNA spacer length is 17-21 nt");
      modRecs.push("Requires NGG PAM adjacent to target site (SpCas9)");
      if (/TTTT/.test(seq)) modRecs.push("Poly-T tract detected — may cause premature transcription termination");
      modDetails = { ...modDetails, casProtein: "SpCas9 (NGG PAM)", optimalLength: "20 nt spacer + PAM" };
    }
    return {
      sequence: seq,
      sequenceType: length > 0 ? (hasT ? "dna" : "rna") : "unknown",
      length,
      gcContent: gc,
      offTarget: {
        lengthBasedRiskEstimate: offRisk,
        note: offNote,
        internalRepetitiveness: Math.round(repetitiveness * 1000) / 1000,
        recommendedMinLength: 18,
        disclaimer: "This is a length/repetitiveness heuristic only — it does not check the sequence against any real genome or transcriptome. Use a real alignment tool (e.g. BLAST) for actual off-target screening.",
      },
      secondaryStructure: { estimatedMfe: mfe, palindromicRegions: palindromes, palindromePositions: palindromePositions.slice(0, 50), gcContent: gc, hairpinRisk: palindromes > 3 ? "High" : palindromes > 1 ? "Medium" : "Low" },
      immuneScreen: immune,
      modality: modDetails,
      gcCurve,
      composition,
      orfs: orfs.slice(0, 20),
    };
  }

  async function handleValidate() {
    if (!rawInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let result: ValidationReport | null = null;
      try {
        result = await validateSequence(rawInput, filename) as unknown as ValidationReport;
      } catch {
        result = clientSideValidate(rawInput, filename) as unknown as ValidationReport;
      }
      if (!result) {
        setError("Could not parse sequence.");
        setLoading(false);
        return;
      }
      setValidation(result);
      if (!result.valid) {
        setError(`Invalid characters found: ${result.invalidChars.join(", ")}`);
      }
      setStep("validate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!validation?.sequence || !selectedModality) return;
    setLoading(true);
    setError(null);
    try {
      let result: AnalysisReport | null = null;
      try {
        result = await analyzeSequence(validation.sequence, selectedModality as Modality) as unknown as AnalysisReport;
      } catch {
        result = clientSideAnalyze(validation.sequence, selectedModality) as unknown as AnalysisReport;
      }
      if (!result) {
        setError("Analysis failed.");
        setLoading(false);
        return;
      }
      setAnalysis(result);
      setStep("analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setRawInput("");
    setFilename(undefined);
    setValidation(null);
    setSelectedModality(null);
    setAnalysis(null);
    setError(null);
  }

  function toggleRec(key: string) {
    setExpandedRecs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          {/* Header */}
          <Card className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-50">
              <UploadCloud className="h-4.5 w-4.5 text-violet-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Upload Sequence</p>
              <p className="text-[12px] text-slate-500">
                Upload FASTA files or paste raw sequences for custom analysis
              </p>
            </div>
            {step !== "upload" && (
              <button
                onClick={handleReset}
                className="ml-auto text-[12.5px] font-medium text-brand hover:underline"
              >
                Start over
              </button>
            )}
          </Card>

          {/* Step indicators */}
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-slate-400">
            {(["upload", "validate", "modality", "analysis"] as Step[]).map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">→</span>}
                <span
                  className={`rounded-md px-2 py-0.5 ${
                    step === s
                      ? "bg-brand text-white"
                      : ["upload", "validate", "modality", "analysis"].indexOf(step) > i
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </span>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ===== STEP 1: UPLOAD ===== */}
          {step === "upload" && (
            <Card>
              <SectionHeader step="1" title="Input Sequence" />
              <div className="px-6 pb-6 space-y-4">
                {/* Paste area */}
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
                    Paste Sequence (FASTA or raw)
                  </label>
                  <textarea
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder={`>header optional\ndna or rna sequence here...\n\nOr paste raw:\nATGCGATCGATCGATCG...`}
                    rows={8}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-[13px] font-mono text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-y"
                  />
                </div>

                {/* File drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition-colors hover:border-brand/40 hover:bg-brand/[0.02]"
                >
                  <UploadCloud className="h-8 w-8 text-slate-300" />
                  <p className="text-[13px] font-medium text-slate-500">
                    Drop a FASTA/GenBank file here, or click to browse
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports .fasta, .fa, .txt, .genbank, .gb
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".fasta,.fa,.txt,.genbank,.gb,.fastq,.fq"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {filename && rawInput && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-600">
                    <FileText className="h-3.5 w-3.5" />
                    Loaded: {filename} ({rawInput.length.toLocaleString()} chars)
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleValidate}
                    disabled={!rawInput.trim() || loading}
                    className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Validating..." : "Validate Sequence"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ===== STEP 2: VALIDATION ===== */}
          {step === "validate" && validation && (
            <Card>
              <SectionHeader
                step="2"
                title="Sequence Validation"
                right={
                  <button
                    onClick={() => setStep("upload")}
                    className="flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                  >
                    <ArrowLeft className="h-3 w-3" /> Edit
                  </button>
                }
              />
              <div className="px-6 pb-6 space-y-4">
                {/* Status banner */}
                <div
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                    validation.valid
                      ? "border border-emerald-200 bg-emerald-50"
                      : "border border-amber-200 bg-amber-50"
                  }`}
                >
                  {validation.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className={`text-[13px] font-medium ${validation.valid ? "text-emerald-700" : "text-amber-700"}`}>
                      {validation.valid ? "Sequence is valid" : "Sequence has issues"}
                    </p>
                    <p className={`text-[11.5px] ${validation.valid ? "text-emerald-600" : "text-amber-600"}`}>
                      {validation.valid
                        ? "All characters are valid IUPAC nucleotides"
                        : `Invalid characters: ${validation.invalidChars.join(", ")}`}
                    </p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Length</p>
                    <p className="text-[18px] font-bold text-slate-800 mt-0.5">
                      {validation.length.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">nucleotides</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Type</p>
                    <p className="text-[18px] font-bold text-slate-800 mt-0.5 uppercase">
                      {validation.sequenceType}
                    </p>
                    <p className="text-[10px] text-slate-400">detected</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">GC Content</p>
                    <p className="text-[18px] font-bold text-slate-800 mt-0.5">
                      {validation.gcContent}%
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {validation.gcContent >= 40 && validation.gcContent <= 60 ? "optimal" : "suboptimal"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Features</p>
                    <p className="text-[18px] font-bold text-slate-800 mt-0.5">
                      {validation.features.length}
                    </p>
                    <p className="text-[10px] text-slate-400">detected</p>
                  </div>
                </div>

                {/* Features */}
                {validation.features.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12.5px] font-medium text-slate-600">Detected Features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {validation.features.map((f) => (
                        <span key={f} className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ORFs */}
                {validation.orfs.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12.5px] font-medium text-slate-600">Open Reading Frames ({validation.orfs.length} found, both strands)</p>
                    <div className="space-y-1.5">
                      {validation.orfs.map((orf, i) => (
                        <div key={`${orf.frame}-${orf.start}-${i}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            orf.strand === "-" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {orf.strand} strand
                          </span>
                          <span className="font-mono text-slate-500">Frame {orf.frame}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600">
                            {orf.start}–{orf.end} ({orf.proteinLength} aa)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-slate-600">Sequence Preview</p>
                  <p className="max-h-20 overflow-y-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-500 break-all">
                    {validation.sequence.slice(0, 200)}
                    {validation.sequence.length > 200 && "..."}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setStep("modality")}
                    className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm hover:bg-brand-dark"
                  >
                    Choose Modality <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ===== STEP 3: MODALITY ===== */}
          {step === "modality" && (
            <Card>
              <SectionHeader
                step="3"
                title="Select Therapeutic Modality"
                right={
                  <button
                    onClick={() => setStep("validate")}
                    className="flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                }
              />
              <div className="px-6 pb-6 space-y-4">
                <p className="text-[12.5px] text-slate-500">
                  Choose the therapeutic modality for your uploaded sequence.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MODALITIES.map((m) => {
                    const Icon = m.icon;
                    const isSelected = selectedModality === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModality(m.id)}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-brand bg-brand/5 ring-1 ring-brand"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-brand text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{m.name}</p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">{m.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAnalyze}
                    disabled={!selectedModality || loading}
                    className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Analyzing..." : "Run Analysis"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ===== STEP 4: ANALYSIS ===== */}
          {step === "analysis" && analysis && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <SectionHeader step="4" title="Analysis Results" />
                <div className="flex items-center gap-3">
                  <ExportMenu
                    sequence={analysis.sequence}
                    validation={{
                      valid: true,
                      sequenceType: (validation?.sequenceType ?? analysis.sequenceType) as "dna" | "rna" | "unknown",
                      length: validation?.length ?? analysis.length,
                      gcContent: validation?.gcContent ?? analysis.gcContent,
                      features: validation?.features ?? [],
                      orfs: (validation?.orfs ?? analysis.orfs).map((orf) => ({
                        ...orf,
                        strand: orf.strand as "+" | "-",
                      })),
                      invalidChars: [],
                      hasPolyA: validation?.hasPolyA ?? false,
                      hasPolyG: validation?.hasPolyG ?? false,
                    }}
                    analysis={analysis as unknown as AnalyzeResponse}
                    modalityName={MODALITIES.find((m) => m.id === selectedModality)?.name ?? selectedModality ?? ""}
                  />
                  <button
                    onClick={() => setStep("modality")}
                    className="flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change modality
                  </button>
                </div>
              </div>

              {/* Summary bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Sequence Type</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5 uppercase">{analysis.sequenceType}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Length</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5">{analysis.length.toLocaleString()} nt</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">GC Content</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5">{analysis.gcContent}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Modality</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5 uppercase">{MODALITIES.find((m) => m.id === selectedModality)?.name ?? selectedModality}</p>
                </div>
              </div>

              {/* Sequence Track Viewer — full width */}
              <Card className="p-5">
                <p className="text-[14px] font-semibold text-slate-800 mb-3">Sequence Map</p>
                <SequenceTrackViewer
                  seqLength={analysis.length}
                  orfs={analysis.orfs}
                  immuneHits={analysis.immuneScreen}
                  palindromePositions={analysis.secondaryStructure.palindromePositions ?? []}
                />
              </Card>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* GC Content Chart — full width */}
                <Card className="p-5 lg:col-span-2">
                  <p className="text-[14px] font-semibold text-slate-800 mb-1">GC Content Distribution</p>
                  <p className="text-[11px] text-slate-400 mb-3">10 nt sliding window — green band marks the 40–60% optimal range</p>
                  <GcContentChart data={analysis.gcCurve} seqLength={analysis.length} />
                </Card>

                {/* Nucleotide Composition */}
                <Card className="p-5">
                  <p className="text-[14px] font-semibold text-slate-800 mb-3">Nucleotide Composition</p>
                  <NucleotideCompositionChart composition={analysis.composition} />
                </Card>

                {/* Specificity Heuristic */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <p className="text-[14px] font-semibold text-slate-800">Specificity Heuristic</p>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        analysis.offTarget.lengthBasedRiskEstimate === "Low"
                          ? "bg-emerald-100 text-emerald-700"
                          : analysis.offTarget.lengthBasedRiskEstimate === "Medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {analysis.offTarget.lengthBasedRiskEstimate} Risk
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-2">{analysis.offTarget.note}</p>
                  <div className="rounded-lg bg-slate-50 p-3 mb-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Internal repetitiveness</span>
                      <span className="font-medium text-slate-600">{(analysis.offTarget.internalRepetitiveness * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${analysis.offTarget.internalRepetitiveness > 0.3 ? "bg-red-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(analysis.offTarget.internalRepetitiveness * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {analysis.offTarget.disclaimer}
                  </div>
                </Card>

                {/* Secondary Structure */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Thermometer className="h-4 w-4 text-slate-500" />
                    <p className="text-[14px] font-semibold text-slate-800">Secondary Structure</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-[10px] uppercase text-slate-400">Est. ΔG</p>
                      <p className="text-[16px] font-bold text-slate-800 mt-0.5">{analysis.secondaryStructure.estimatedMfe} kcal/mol</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-[10px] uppercase text-slate-400">Palindromes</p>
                      <p className="text-[16px] font-bold text-slate-800 mt-0.5">{analysis.secondaryStructure.palindromicRegions}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-slate-400">Hairpin risk:</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        analysis.secondaryStructure.hairpinRisk === "Low"
                          ? "bg-emerald-100 text-emerald-700"
                          : analysis.secondaryStructure.hairpinRisk === "Medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {analysis.secondaryStructure.hairpinRisk}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Composition-based MFE estimate, not a real folding prediction (e.g. RNAfold). Treat as a rough proxy only.
                  </div>
                </Card>

                {/* Immune Screen */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Syringe className="h-4 w-4 text-slate-500" />
                    <p className="text-[14px] font-semibold text-slate-800">Immune Sensing Patterns</p>
                  </div>
                  {analysis.immuneScreen.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <p className="text-[12px] text-emerald-600">No immunostimulatory motifs detected</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {analysis.immuneScreen.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px]">
                          <span className="font-mono font-semibold text-amber-700 shrink-0">{m.motif}</span>
                          <span className="text-amber-600 shrink-0">@ {m.start}–{m.end}</span>
                          <span className="text-slate-500 truncate">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Pattern-matching against a short literature-informed list, not a validated immunogenicity assay. Positions are exact regex matches; biological labels are literature-informed guesses.
                  </div>
                </Card>

                {/* Modality Recommendations */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <p className="text-[14px] font-semibold text-slate-800">
                      {MODALITIES.find((m) => m.id === selectedModality)?.name ?? "Modality"} Recommendations
                    </p>
                  </div>
                  <div className="space-y-2">
                    {analysis.modality.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <Star className="h-3 w-3 mt-0.5 shrink-0 text-brand" />
                        <p className="text-[12px] text-slate-600">{rec}</p>
                      </div>
                    ))}
                  </div>
                  {analysis.modality.optimalLength && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-500">
                      <span className="font-medium">Optimal length:</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">{analysis.modality.optimalLength}</span>
                    </div>
                  )}
                  {analysis.modality.recommendedChemistry && (
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 mt-1">
                      <span className="font-medium">Chemistry:</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">{analysis.modality.recommendedChemistry}</span>
                    </div>
                  )}
                  {analysis.modality.casProtein && (
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 mt-1">
                      <span className="font-medium">Cas protein:</span>
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-600">{analysis.modality.casProtein}</span>
                    </div>
                  )}
                  {analysis.modality.nucleosideModifications && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium text-slate-500 mb-1">Suggested modifications:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.modality.nucleosideModifications.map((mod) => (
                          <span key={mod} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-medium text-blue-600">{mod}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Upload New Sequence
                </button>
                <button
                  onClick={() => setStep("modality")}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm hover:bg-brand-dark"
                >
                  Try Different Modality <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
