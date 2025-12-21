'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ModelOption {
  value: string;
  label: string;
}

interface AgentModelCardProps {
  title: string;
  description?: string;
  models: ModelOption[];
  selectedModel: string;
  onSave: (model: string) => Promise<void>;
}

export function AgentModelCard({
  title,
  description,
  models,
  selectedModel,
  onSave,
}: AgentModelCardProps) {
  const [localModel, setLocalModel] = useState(selectedModel);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalModel(selectedModel);
    setHasChanges(false);
  }, [selectedModel]);

  const handleChange = (value: string) => {
    setLocalModel(value);
    setHasChanges(value !== selectedModel);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localModel);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={localModel}
            onChange={(e) => handleChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
