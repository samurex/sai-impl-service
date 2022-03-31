import type { DatasetCore, Quad_Object, Quad_Subject } from '@rdfjs/types';

export const getOneObject = (set: DatasetCore): Quad_Object | undefined => [...set].shift()?.object;
export const getOneSubject = (set: DatasetCore): Quad_Subject | undefined => [...set].shift()?.subject;

export const getAllObjects = (set: DatasetCore): Quad_Object[] => [...set].map((q) => q.object);
export const getAllSubjects = (set: DatasetCore): Quad_Subject[] => [...set].map((q) => q.subject);
