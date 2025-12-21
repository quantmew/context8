'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { DeleteProjectDialog } from './delete-project-dialog';

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function DeleteProjectButton({
  projectId,
  projectName,
  variant = 'outline',
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setShowDialog(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Project
      </Button>

      <DeleteProjectDialog
        open={showDialog}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setShowDialog(false)}
        onDeleted={() => {
          setShowDialog(false);
          router.push('/');
        }}
      />
    </>
  );
}
