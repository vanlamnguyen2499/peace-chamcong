const dates = [new Date(), '2026-09-04', '04/09/2026'];
for (const rawDate of dates) {
  let workDateStr = '';
  if (rawDate instanceof Date) {
    workDateStr = rawDate.toISOString().split('T')[0];
  } else if (typeof rawDate === 'string') {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      workDateStr = parsed.toISOString().split('T')[0];
    } else {
      // what if we just split?
    }
  }
  console.log(`rawDate = ${rawDate}, workDateStr = ${workDateStr}`);
}
