/**
 * @file clinicalTrials.ts
 * @description ClinicalTrials.gov API v2 connector for real-time trial protocol & cohort retrieval.
 */

import { RAGDocumentChunk } from '../../../types/rag';

export async function fetchClinicalTrials(
  condition: string,
  maxResults: number = 6
): Promise<RAGDocumentChunk[]> {
  try {
    const encodedCond = encodeURIComponent(condition);
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodedCond}&pageSize=${maxResults}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`ClinicalTrials.gov API error: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const studies = data?.studies || [];

    return studies.map((study: any, index: number): RAGDocumentChunk => {
      const protocol = study?.protocolSection || {};
      const nctId = protocol?.identificationModule?.nctId || `NCT-UNKNOWN-${index}`;
      const title = protocol?.identificationModule?.officialTitle || protocol?.identificationModule?.briefTitle || 'Untitled Clinical Trial';
      const status = protocol?.statusModule?.overallStatus || 'Unknown Status';
      const sponsor = protocol?.sponsorCollaboratorsModule?.leadSponsor?.name || 'Academic Institution / Sponsor';
      const summary = protocol?.descriptionModule?.briefSummary || 'No summary available.';
      const eligibility = protocol?.eligibilityModule?.eligibilityCriteria || '';

      const studyUrl = `https://clinicaltrials.gov/study/${nctId}`;

      return {
        id: `nct-${nctId}`,
        refTag: `[TRIALS-${nctId}]`,
        title,
        abstract: summary,
        text: `TRIAL ID: ${nctId}\nTITLE: ${title}\nSTATUS: ${status}\nSPONSOR: ${sponsor}\nSUMMARY: ${summary}\nELIGIBILITY: ${eligibility.slice(0, 300)}...`,
        source: 'clinical_trials',
        sourceName: `ClinicalTrials.gov (${nctId})`,
        url: studyUrl,
        nctId,
        publicationDate: protocol?.statusModule?.startDateStruct?.date || '',
      };
    });
  } catch (error) {
    console.error('Failed to fetch from ClinicalTrials.gov:', error);
    return [];
  }
}
