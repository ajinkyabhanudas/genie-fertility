/**
 * @file openFda.ts
 * @description openFDA 510(k) and IVD regulatory clearance connector.
 */

import { RAGDocumentChunk } from '../../../types/rag';

export async function fetchOpenFdaClearances(
  deviceKeyword: string,
  maxResults: number = 5
): Promise<RAGDocumentChunk[]> {
  try {
    const encodedQuery = encodeURIComponent(deviceKeyword);
    const url = `https://api.fda.gov/device/510k.json?search=device_name:${encodedQuery}&limit=${maxResults}`;

    const response = await fetch(url);
    if (!response.ok) {
      // If 404 or no match, fallback to general medical search
      return [];
    }

    const data = await response.json();
    const results = data?.results || [];

    return results.map((item: any, index: number): RAGDocumentChunk => {
      const kNumber = item.k_number || `K${index}`;
      const deviceName = item.device_name || 'Medical Diagnostic Device';
      const applicant = item.applicant || 'Manufacturer';
      const decisionDate = item.decision_date || '';
      const statement = item.statement_or_summary || item.device_name;

      const fdaUrl = `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${kNumber}`;

      return {
        id: `fda-${kNumber}`,
        refTag: `[FDA-${kNumber}]`,
        title: `FDA 510(k) Clearance: ${deviceName} (${kNumber})`,
        abstract: `Applicant: ${applicant}. Decision Date: ${decisionDate}.`,
        text: `FDA K-NUMBER: ${kNumber}\nDEVICE: ${deviceName}\nAPPLICANT: ${applicant}\nCLEARANCE DATE: ${decisionDate}\nSUMMARY: ${statement}`,
        source: 'open_fda',
        sourceName: `US FDA CDRH (${kNumber})`,
        url: fdaUrl,
        publicationDate: decisionDate,
      };
    });
  } catch (error) {
    console.error('Failed to fetch from openFDA:', error);
    return [];
  }
}
