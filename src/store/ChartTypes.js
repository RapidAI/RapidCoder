export const ChartTypes = {
    bar: `
\`\`\`chart
{
  "chartType": "bar",
  "data": {
    "labels": [...],
    "datasets": [
      {
        "label": "...",
        "data": [...],
        "backgroundColor": "..."
      },
      {
        "label": "...",
        "data": [...],
        "backgroundColor": "..."
      }
      ...
    ]
  }
}
\`\`\``,
    pie: `
\`\`\`chart
{
  "chartType": "pie",
  "data": {
    "labels": [...],
    "datasets": [
      {
        "label": "...",
        "data": [...],
        "backgroundColor": [...]
      }
      ...
    ]
  }
}
\`\`\``,
    line: `
\`\`\`chart
{
  "chartType": "line",
  "data": {
    "labels": [...],
    "datasets": [
      {
        "label": "...",
        "data": [...],
        "backgroundColor": "..."
      },
      {
        "label": "...",
        "data": [...],
        "backgroundColor": "..."
      }
      ...
    ]
  }
}
\`\`\``,
    radar: `
\`\`\`chart
{
  "chartType": "radar",
  "data": {
    "labels": [...],
    "datasets": [
      {
        "label": "...",
        "data": [...],
        "backgroundColor": "...",
        "pointBackgroundColor": "...",
        "pointHoverBackgroundColor": "..."
      }
      ...
    ]
  }
}
\`\`\``,
    polarArea: `
\`\`\`chart
{
  "chartType": "polarArea",
  "data": {
    "labels": [...],
    "datasets": [
      {
        "label": "...",
        "data": [...],
        "backgroundColor": [...]
      }
      ...
    ]
  }
}
\`\`\``,
    scatter: `
\`\`\`chart
{
  "chartType": "scatter",
  "data": {
    "datasets": [
      {
        "label": "...",
        "data": [
          { "x": ..., "y": ... }
          ...
        ],
        "backgroundColor": "..."
      }
      ...
    ]
  }
}
\`\`\``
};