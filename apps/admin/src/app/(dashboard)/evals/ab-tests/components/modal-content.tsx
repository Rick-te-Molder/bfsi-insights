'use client';

import type { PromptVersion } from '@/types/database';
import {
  TestNameField,
  AgentSelect,
  VariantSelect,
  TrafficSplitField,
  SampleSizeField,
  ModalFooter,
} from './form-fields';

interface ModalContentProps {
  name: string;
  setName: (v: string) => void;
  agents: string[];
  agentName: string;
  setAgentName: (v: string) => void;
  agentPrompts: PromptVersion[];
  variantA: string;
  setVariantA: (v: string) => void;
  variantB: string;
  setVariantB: (v: string) => void;
  trafficSplit: number;
  setTrafficSplit: (v: number) => void;
  sampleSize: number;
  setSampleSize: (v: number) => void;
  onClose: () => void;
  onCreate: () => void;
  saving: boolean;
}

interface VariantSelectsProps {
  agentPrompts: PromptVersion[];
  variantA: string;
  setVariantA: (v: string) => void;
  variantB: string;
  setVariantB: (v: string) => void;
}

function VariantSelects({
  agentPrompts,
  variantA,
  setVariantA,
  variantB,
  setVariantB,
}: Readonly<VariantSelectsProps>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <VariantSelect
        id="variantA"
        label="Variant A"
        color="text-emerald-400"
        value={variantA}
        onChange={setVariantA}
        prompts={agentPrompts}
      />
      <VariantSelect
        id="variantB"
        label="Variant B"
        color="text-amber-400"
        value={variantB}
        onChange={setVariantB}
        prompts={agentPrompts}
      />
    </div>
  );
}

function SplitSizeFields({
  trafficSplit,
  setTrafficSplit,
  sampleSize,
  setSampleSize,
}: Readonly<{
  trafficSplit: number;
  setTrafficSplit: (v: number) => void;
  sampleSize: number;
  setSampleSize: (v: number) => void;
}>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TrafficSplitField value={trafficSplit} onChange={setTrafficSplit} />
      <SampleSizeField value={sampleSize} onChange={setSampleSize} />
    </div>
  );
}

export function ModalContent(props: Readonly<ModalContentProps>) {
  return (
    <>
      <h2 className="text-lg font-bold text-white mb-4">Create A/B Test</h2>
      <div className="space-y-4">
        <TestNameField value={props.name} onChange={props.setName} />
        <AgentSelect agents={props.agents} value={props.agentName} onChange={props.setAgentName} />
        <VariantSelects
          agentPrompts={props.agentPrompts}
          variantA={props.variantA}
          setVariantA={props.setVariantA}
          variantB={props.variantB}
          setVariantB={props.setVariantB}
        />
        <SplitSizeFields
          trafficSplit={props.trafficSplit}
          setTrafficSplit={props.setTrafficSplit}
          sampleSize={props.sampleSize}
          setSampleSize={props.setSampleSize}
        />
      </div>
      <ModalFooter onClose={props.onClose} onCreate={props.onCreate} saving={props.saving} />
    </>
  );
}
