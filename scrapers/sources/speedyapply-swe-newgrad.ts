import {
  extractCellText,
  extractFirstUrl,
  fetchCuratedGitHubJobs,
  isMarkdownTableSeparator,
  splitMarkdownRow,
  type CuratedRepoRow,
} from '../utils/github-curated';
import { NormalizedJob } from '../utils/normalize';

function parseSpeedyapplyMarkdown(markdown: string): CuratedRepoRow[] {
  const rows: CuratedRepoRow[] = [];

  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|') || isMarkdownTableSeparator(line)) continue;

    const cells = splitMarkdownRow(line);
    if (cells.length < 5 || cells[0] === 'Company') continue;

    if (cells.length === 6) {
      const [companyCell, titleCell, locationCell, , applyCell, postedCell] = cells;
      rows.push({
        company: extractCellText(companyCell),
        title: extractCellText(titleCell),
        location: extractCellText(locationCell),
        url: extractFirstUrl(applyCell),
        posted: postedCell.trim(),
      });
      continue;
    }

    const [companyCell, titleCell, locationCell, applyCell, postedCell] = cells;
    rows.push({
      company: extractCellText(companyCell),
      title: extractCellText(titleCell),
      location: extractCellText(locationCell),
      url: extractFirstUrl(applyCell),
      posted: postedCell.trim(),
    });
  }

  return rows;
}

export async function scrapeSpeedyApplySWENewGrad(): Promise<NormalizedJob[]> {
  return fetchCuratedGitHubJobs({
    source: 'speedyapply_swe_newgrad',
    repo: 'speedyapply/2026-SWE-College-Jobs',
    branches: ['main'],
    markdownPaths: ['NEW_GRAD_USA.md', 'README.md', 'NEW_GRAD.md'],
    allowJson: false,
    parseMarkdown: parseSpeedyapplyMarkdown,
  });
}
