import { z } from 'zod';

export const FilesSchema = z.object({
  id: z.union([z.string(), z.number()]),
  user_id: z.string(),
  parent_id: z.union([z.string(), z.number()]).nullable(),
  name: z.string(),
  type: z.enum(['directory', 'file']),
  size: z.number().nullable(),
  content: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UpdatableFieldsSchema = z.object({
  name: z.string().optional(),
  parent_id: z.union([z.string(), z.number()]).optional(),
  content: z.string().optional(),
  size: z.number().optional(),
  updated_at: z.string().optional(),
});

export const FileTypeSchema = z.enum(['directory', 'file']);

const FileSchemaNoUser = FilesSchema.omit({ user_id: true }).merge(
  z.object({
    path: z.string(),
  }),
);

export const FilesArraySchema = z.array(FilesSchema);

type FileTree = z.infer<typeof FileSchemaNoUser> & {
  children?: z.RecordType<string, FileTree>;
};

export const FileTreeSchema: z.ZodType<FileTree> = FileSchemaNoUser.extend({
  children: z.lazy(() => z.record(FileSchemaNoUser)).optional(),
});

export const FileTreeArraySchema = z.record(FileTreeSchema);
