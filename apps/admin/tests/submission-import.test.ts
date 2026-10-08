import { describe, expect, it } from 'vitest';
import { importHeaders, parseSubmissionImport } from '../src/domain/submissionImport';
const header = importHeaders.join(',');
describe('线下稿件CSV预检', () => {
  it('兼容BOM、Windows换行、逗号和带引号的多行正文，账号ID不损失精度', () => {
    const csv = '\uFEFF' + header + '\r\n90071992547409930,A-1,秋季归集,家书,作者,"第一行,带逗号\r\n第二行""引文""",zhejiang,letter,school,filial|heritage,\r\n';
    const rows = parseSubmissionImport(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ownerId).toBe('90071992547409930');
    expect(rows[0]!.content).toBe('第一行,带逗号\r\n第二行"引文"');
    expect(rows[0]!.themes).toEqual(['filial', 'heritage']);
  });
  it('拒绝表头、列数、引号和超出批量上限的输入', () => {
    expect(() => parseSubmissionImport('其他标题\n123')).toThrow('列名');
    expect(() => parseSubmissionImport(header + '\n123')).toThrow('列数');
    expect(() => parseSubmissionImport(header + '\n"unclosed')).toThrow('引号');
    expect(() => parseSubmissionImport(header + '\n' + Array.from({ length: 101 }, () => '1,A,B,C,D,E,F,G,H,I,J').join('\n'))).toThrow('100');
  });
});
