export interface CreateGoldenSetFormData {
  agentName: string;
  name: string;
  description: string;
  inputJson: string;
  expectedJson: string;
  saving: boolean;
}

export interface CreateGoldenSetModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export interface CreateGoldenSetFormProps {
  formData: CreateGoldenSetFormData;
  setAgentName: (v: string) => void;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setInputJson: (v: string) => void;
  setExpectedJson: (v: string) => void;
  handleCreate: () => void;
  onClose: () => void;
}
