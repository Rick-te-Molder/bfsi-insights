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

export function validateForm(params: ValidationParams): { valid: boolean; error?: string } {
  const {
    inputMode,
    url,
    pdfFile,
    pdfTitle,
    submitterName,
    whyValuable,
    submitterAudience,
    submitterChannel,
    submitterUrgency,
  } = params;

  if (inputMode === 'url' && !url.trim()) {
    return { valid: false, error: 'Please enter a URL' };
  }
  if (inputMode === 'pdf' && !pdfFile) {
    return { valid: false, error: 'Please select a PDF file' };
  }
  if (inputMode === 'pdf' && !pdfTitle.trim()) {
    return { valid: false, error: 'Please enter a title for the PDF' };
  }
  if (!submitterName.trim()) {
    return { valid: false, error: 'Please enter the submitter name/company' };
  }
  if (!whyValuable.trim()) {
    return { valid: false, error: 'Please explain why this article was valuable' };
  }
  if (!submitterAudience) {
    return { valid: false, error: "Please select the submitter's audience/role" };
  }
  if (!submitterChannel) {
    return { valid: false, error: 'Please select the channel' };
  }
  if (!submitterUrgency) {
    return { valid: false, error: 'Please select the urgency level' };
  }

  return { valid: true };
}
