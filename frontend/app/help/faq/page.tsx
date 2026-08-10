import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";

const FAQS = [
  {
    q: "Why does it say a gene wasn't found, even though I'm sure the symbol is right?",
    a: "The platform queries Ensembl for that exact symbol in the exact organism selected. Try the organism's canonical casing (e.g. \"Dmd\" for mouse vs \"DMD\" for human — though Ensembl's lookup is generally case-insensitive), and confirm the organism is actually one of the live-tier species, not one marked \"Coming soon.\"",
  },
  {
    q: "What does \"Curated reference\" mean on a viral gene result?",
    a: "Viral genomes aren't in Ensembl, so Tier 5 (viruses) uses a small hand-compiled dataset of well-known genes for 6 viruses, rather than a live database connector. It's real reference data, but not fetched live the way Tier 1-3 organism data is.",
  },
  {
    q: "Why do some fields say \"Not yet connected\" instead of a value?",
    a: "Most data sources are now live (KEGG, Reactome, GO, Pathway Commons, GTEx, STRING, ADMET). If a card still shows \"Not yet connected\", the upstream API timed out or returned no data for this gene — it's not a permanent disconnect, just a transient fetch failure. Try re-running the target lookup.",
  },
  {
    q: "Why doesn't Mechanism Selection cover all 26 mechanisms?",
    a: "All 26 mechanisms exist in the rulebook data, but the interactive scoring/ranking flow currently only covers Gene Silencing (TG01, 5 mechanisms) and RNA Processing Modulation (TG04, 5 mechanisms). The rest of the rulebook is present but not yet wired into this page.",
  },
  {
    q: "Why did A21 (siRNA) show a warning instead of letting me proceed to Candidate Design?",
    a: "Candidate Design currently only supports single-stranded ASO chemistries (gapmer, PMO, LNA-gapmer, 2'-OMe). siRNA is a double-stranded RNA duplex — a different modality — so there's no valid chemistry mapping for it yet, and the platform blocks that path rather than silently generating an incorrect result.",
  },
  {
    q: "Is the \"off-target risk\" or \"specificity\" score a real off-target check?",
    a: "No. It's a heuristic based on sequence length and internal repetitiveness only — it does not align your sequence against any genome or transcriptome. Wherever it appears, it's labeled as a heuristic, not a real specificity screen. Use a real alignment tool (e.g. BLAST) for that.",
  },
  {
    q: "Is the secondary structure / MFE estimate a real RNA fold prediction?",
    a: "No — it's a simplified estimate based on GC/AU composition, not an actual folding algorithm like RNAfold. It's meant as a rough proxy, not a substitute for real structure prediction.",
  },
  {
    q: "Does \"Ask the Platform AI\" know things outside this platform?",
    a: "It's a general-purpose AI assistant with added context about how this platform works, so it can explain ASO biology broadly, not just answer questions about your specific loaded gene. It's a research aid, not a source of clinical/medical advice.",
  },
];

export default function FaqPage() {
  return (
    <HelpPageShell title="FAQ" subtitle="Questions about how this specific platform actually behaves.">
      {FAQS.map((f) => (
        <Card key={f.q} className="p-5">
          <p className="text-[13px] font-semibold text-slate-800">{f.q}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{f.a}</p>
        </Card>
      ))}
    </HelpPageShell>
  );
}
