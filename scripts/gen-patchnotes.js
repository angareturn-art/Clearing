import fs from 'fs';
import path from 'path';
import { CHANGELOG } from '../src/constants/changelog.js';

const outPath = path.join(process.cwd(), 'PATCH_NOTES.md');

const body = CHANGELOG.map((release) => {
  const header = `## ${release.emoji || '🚀'} v${release.version} (${release.date})${release.title ? ` - ${release.title}` : ''}`;
  const bullets = release.changes.map((change) => `- ${change}`).join('\n');
  return `${header}\n${bullets}`;
}).join('\n\n');

const content = `# 세대청소 관리 패치 노트 (Release Notes)\n\n${body}\n\n---\n*본 파일은 \`src/constants/changelog.js\`로부터 \`npm run release:notes\`로 자동 생성됩니다. 직접 수정하지 마세요.*\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Generated ${outPath}`);
