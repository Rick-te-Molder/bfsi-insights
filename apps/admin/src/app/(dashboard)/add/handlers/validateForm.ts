interface ValidationParams {
  inputMode: 'url' | 'pdf';
  url: string;
  pdfFile: File | null;
  pdfTitle: string;
  submitterName: string;
  whyValuable: string;
  submitterAudience: string;
  submitterChannel: string;
  submitterUrgency: string;
}

function validateInputMode(params: ValidationParams): string | null {
  const { inputMode, url, pdfFile, pdfTitle } = params;

  if (inputMode === 'url' && !url.trim()) {
    return 'Please enter a URL';
  }
  if (inputMode === 'pdf' && !pdfFile) {
    return 'Please select a PDF file';
  }
  if (inputMode === 'pdf' && !pdfTitle.trim()) {
    return 'Please enter a title for the PDF';
  }
  return null;
}

function validateRequiredFields(params: ValidationParams): string | null {
  const { submitterName, whyValuable, submitterAudience, submitterChannel, submitterUrgency } =
    params;

  if (!submitterName.trim()) return 'Please enter the submitter name/company';
  if (!whyValuable.trim()) return 'Please explain why this article was valuable';
  if (!submitterAudience) return "Please select the submitter's audience/role";
  if (!submitterChannel) return 'Please select the channel';
  if (!submitterUrgency) return 'Please select the urgency level';
  return null;
}

export function validateForm(params: ValidationParams): { valid: boolean; error?: string } {
  const inputModeError = validateInputMode(params);
  if (inputModeError) return { valid: false, error: inputModeError };

  const requiredFieldsError = validateRequiredFields(params);
  if (requiredFieldsError) return { valid: false, error: requiredFieldsError };

  return { valid: true };
}
