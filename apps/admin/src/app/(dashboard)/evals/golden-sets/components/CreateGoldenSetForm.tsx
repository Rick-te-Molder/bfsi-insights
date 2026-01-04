'use client';

import type { CreateGoldenSetFormProps } from './CreateGoldenSetForm.types';
import {
  CreateGoldenSetFormAgentField,
  CreateGoldenSetFormNameField,
  CreateGoldenSetFormInputField,
  CreateGoldenSetFormExpectedField,
  CreateGoldenSetFormActions,
} from './CreateGoldenSetFormFields';

function CreateGoldenSetFormAgentNameSection({
  agentName,
  setAgentName,
  name,
  setName,
  agentOptions,
}: {
  agentName: string;
  setAgentName: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  agentOptions: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <CreateGoldenSetFormAgentField
        agentName={agentName}
        setAgentName={setAgentName}
        agentOptions={agentOptions}
      />
      <CreateGoldenSetFormNameField name={name} setName={setName} />
    </div>
  );
}

function CreateGoldenSetFormDescriptionSection({
  description,
  setDescription,
}: {
  description: string;
  setDescription: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor="golden-set-description" className="block text-sm text-neutral-400 mb-1">
        Description (optional)
      </label>
      <input
        id="golden-set-description"
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What makes this a good test case?"
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
      />
    </div>
  );
}

function CreateGoldenSetFormJsonSection({
  inputJson,
  setInputJson,
  expectedJson,
  setExpectedJson,
}: {
  inputJson: string;
  setInputJson: (v: string) => void;
  expectedJson: string;
  setExpectedJson: (v: string) => void;
}) {
  return (
    <>
      <CreateGoldenSetFormInputField inputJson={inputJson} setInputJson={setInputJson} />
      <CreateGoldenSetFormExpectedField
        expectedJson={expectedJson}
        setExpectedJson={setExpectedJson}
      />
    </>
  );
}

type CreateGoldenSetFormLayoutProps = CreateGoldenSetFormProps & { agentOptions: string[] };

function CreateGoldenSetFormLayoutSections(props: CreateGoldenSetFormLayoutProps) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <CreateGoldenSetFormAgentNameSection
        agentName={props.formData.agentName}
        setAgentName={props.setAgentName}
        name={props.formData.name}
        setName={props.setName}
        agentOptions={props.agentOptions}
      />
      <CreateGoldenSetFormDescriptionSection
        description={props.formData.description}
        setDescription={props.setDescription}
      />
      <CreateGoldenSetFormJsonSection
        inputJson={props.formData.inputJson}
        setInputJson={props.setInputJson}
        expectedJson={props.formData.expectedJson}
        setExpectedJson={props.setExpectedJson}
      />
      <CreateGoldenSetFormActions
        handleCreate={props.handleCreate}
        onClose={props.onClose}
        saving={props.formData.saving}
      />
    </div>
  );
}

function CreateGoldenSetFormLayoutBody(props: CreateGoldenSetFormLayoutProps) {
  return <CreateGoldenSetFormLayoutSections {...props} />;
}

function CreateGoldenSetFormLayout({ ...props }: CreateGoldenSetFormLayoutProps) {
  return <CreateGoldenSetFormLayoutBody {...props} />;
}

export function CreateGoldenSetForm(props: CreateGoldenSetFormProps) {
  const agentOptions = ['tagger', 'summarizer', 'screener'];
  return <CreateGoldenSetFormLayout {...props} agentOptions={agentOptions} />;
}
