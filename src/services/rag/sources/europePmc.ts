/**
 * @file europePmc.ts
 * @description Europe PMC Open Access REST API connector for clinical literature retrieval.
 */

import { RAGDocumentChunk } from '../../../types/rag';

export async function fetchEuropePmcArticles(
  keyword: string,
  maxResults: number = 8
): Promise<RAGDocumentChunk[]> {
  try {
    const encodedQuery = encodeURIComponent(
      `(${keyword}) AND (biomarker OR diagnostic OR transcriptome OR "menstrual blood" OR fertility)`
    );
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodedQuery}&format=json&pageSize=${maxResults}&resultType=core`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Europe PMC API error: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const resultList = data?.resultList?.result || [];

    return resultList.map((item: any, index: number): RAGDocumentChunk => {
      const pmid = item.pmid || item.id || '';
      const doi = item.doi || '';
      const title = item.title || 'Untitled Article';
      const abstract = item.abstractText || item.title || '';
      const authors = item.authorString ? [item.authorString] : [];
      const pubYear = item.pubYear || '';
      const journal = item.journalTitle || 'Europe PMC Medical Journal';

      const articleUrl = pmid
        ? `https://europepmc.org/article/MED/${pmid}`
        : doi
        ? `https://doi.org/${doi}`
        : 'https://europepmc.org';

      return {
        id: `pmc-${pmid || index}`,
        refTag: `[PMC-${pmid || index + 1}]`,
        title,
        abstract,
        text: `TITLE: ${title}\nJOURNAL: ${journal} (${pubYear})\nAUTHORS: ${item.authorString || 'N/A'}\nABSTRACT: ${abstract}`,
        source: 'europe_pmc',
        sourceName: journal,
        url: articleUrl,
        doi,
        pmid,
        publicationDate: pubYear,
        authors,
      };
    });
  } catch (error) {
    console.error('Failed to fetch from Europe PMC:', error);
    return [];
  }
}
