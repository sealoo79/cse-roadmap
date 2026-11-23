export interface CellBounds { x: number; y: number; width: number; height: number }

export function findTimetableCells({ data, width, height }: ImageData): CellBounds[] {
  const step = Math.max(1, Math.round(width / 240));
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const colors = new Uint16Array(columns * rows);

  // 수업 칸의 단색 배경을 찾는다. 글자와 옅은 격자선은 같은 영역에 포함되지 않는다.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const offset = (y * step * width + x * step) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const light = Math.max(red, green, blue);
      const dark = Math.min(red, green, blue);
      if (data[offset + 3] < 240 || dark < 110 || light < 170 || light - dark < 22) continue;
      colors[y * columns + x] = 1 + ((red >> 4) << 8) + ((green >> 4) << 4) + (blue >> 4);
    }
  }

  const queue = new Uint32Array(colors.length);
  const cells: CellBounds[] = [];
  for (let start = 0; start < colors.length; start++) {
    const color = colors[start];
    if (color === 0) continue;

    let length = 1;
    let left = start % columns;
    let right = left;
    let top = Math.floor(start / columns);
    let bottom = top;
    queue[0] = start;
    colors[start] = 0;

    function enqueue(index: number): void {
      if (colors[index] !== color) return;
      queue[length++] = index;
      colors[index] = 0;
    }

    for (let head = 0; head < length; head++) {
      const position = queue[head];
      const x = position % columns;
      const y = Math.floor(position / columns);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (x > 0) enqueue(position - 1);
      if (x + 1 < columns) enqueue(position + 1);
      if (y > 0) enqueue(position - columns);
      if (y + 1 < rows) enqueue(position + columns);
    }

    const x = left * step;
    const y = top * step;
    const cellWidth = Math.min(width - x, (right - left + 1) * step);
    const cellHeight = Math.min(height - y, (bottom - top + 1) * step);
    const filledRatio = length / ((right - left + 1) * (bottom - top + 1));
    if (cellWidth >= width * .08 && cellWidth <= width * .45
      && cellHeight >= Math.max(22, width * .035) && filledRatio >= .60) {
      cells.push({ x, y, width: cellWidth, height: cellHeight });
    }
  }

  return cells.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 50);
}

const locationText = /(?:산격동|캠퍼스|강의실|융복합관|종합정보센터|IT\s*대학)/iu;

export function titleFromCell(text: string): string {
  const lines = text.normalize('NFKC').split(/\r?\n/).map((line) =>
    line.replace(/^[|\s]+|[|\s]+$/g, '').trim()).filter(Boolean);
  const title: string[] = [];
  for (const line of lines.slice(0, 3)) {
    const location = line.search(locationText);
    const prefix = (location >= 0 ? line.slice(0, location) : line).trim();
    if (/[\p{L}]/u.test(prefix) && !/^[oO0]{1,2}$/.test(prefix)) title.push(prefix);
    if (location >= 0) break;
  }
  return title.join(' ');
}

export function titlesFromText(text: string): string[] {
  return text.normalize('NFKC').split(/\r?\n/).map((line) => line.trim())
    .filter((line) => /[\p{L}]/u.test(line) && !locationText.test(line)
      && !/^(?:시간표|학점계산기|평균\s*학점|취득\s*학점|이름으로|\d{2,4}\s*[-년]|[월화수목금토일](?:\s+[월화수목금토일])*$)/u.test(line));
}
