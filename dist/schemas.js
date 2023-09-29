"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTreeArraySchema = exports.FileTreeSchema = exports.FilesArraySchema = exports.FileTypeSchema = exports.UpdatableFieldsSchema = exports.FilesSchema = void 0;
const zod_1 = require("zod");
exports.FilesSchema = zod_1.z.object({
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    user_id: zod_1.z.string(),
    parent_id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).nullable(),
    name: zod_1.z.string(),
    type: zod_1.z.enum(['directory', 'file']),
    size: zod_1.z.number().nullable(),
    content: zod_1.z.string().nullable(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
});
exports.UpdatableFieldsSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    parent_id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    content: zod_1.z.string().optional(),
    size: zod_1.z.number().optional(),
    updated_at: zod_1.z.string().optional(),
});
exports.FileTypeSchema = zod_1.z.enum(['directory', 'file']);
const FileSchemaNoUser = exports.FilesSchema.omit({ user_id: true }).merge(zod_1.z.object({
    path: zod_1.z.string(),
}));
exports.FilesArraySchema = zod_1.z.array(exports.FilesSchema);
exports.FileTreeSchema = FileSchemaNoUser.extend({
    children: zod_1.z.lazy(() => zod_1.z.record(FileSchemaNoUser)).optional(),
});
exports.FileTreeArraySchema = zod_1.z.record(exports.FileTreeSchema);
