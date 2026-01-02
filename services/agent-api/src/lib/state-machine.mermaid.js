export function buildMermaidDiagram({ statusCodes, normalTransitions, manualTransitions }) {
  const getStatusName = createGetStatusName(statusCodes);
  let diagram = 'stateDiagram-v2\n';

  diagram = appendNormalTransitions(diagram, normalTransitions, getStatusName);
  diagram = appendManualTransitions(diagram, manualTransitions, getStatusName);

  return diagram;
}

function createGetStatusName(statusCodes) {
  const keys = Object.keys(statusCodes);

  return (code) => {
    const name = keys.find((k) => statusCodes[k] === code);
    return name ? name.toLowerCase() : `status_${code}`;
  };
}

function appendNormalTransitions(diagram, normalTransitions, getStatusName) {
  for (const [from, toStates] of Object.entries(normalTransitions)) {
    const fromCode = Number.parseInt(from, 10);
    const fromName = getStatusName(fromCode);

    if (toStates.length === 0) {
      diagram += `    ${fromName} --> [*]\n`;
      continue;
    }

    for (const toCode of toStates) {
      diagram += `    ${fromName} --> ${getStatusName(toCode)}\n`;
    }
  }

  return diagram;
}

function appendManualTransitions(diagram, manualTransitions, getStatusName) {
  for (const [from, toStates] of Object.entries(manualTransitions)) {
    const fromCode = Number.parseInt(from, 10);
    const fromName = getStatusName(fromCode);

    for (const toCode of toStates) {
      diagram += `    ${fromName} -.-> ${getStatusName(toCode)} : manual\n`;
    }
  }

  return diagram;
}
