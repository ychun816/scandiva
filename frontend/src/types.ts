export interface ApplicationStage {
    id: number;
    applicationId: number;
    stageName: string;
    status: 'passed' | 'failed' | 'upcoming';
    date: string;
    notes?: string;
    createdAt: string;
}

export interface Application {
    id: number;
    company: string;
    position: string;
    link?: string;
    platform?: string;
    status: string;
    isArchived: boolean;
    appliedDate: string;
    notes?: string;
    cv?: string;
    coverLetter?: string;
    salary?: string;
    isStarred: boolean;
    contractType?: string;
    resumeId?: number;
    resume?: Resume;
    letterVersionId?: number | null; // linked motivation-letter version (Letters view)
    stages?: ApplicationStage[];
    latestStage?: ApplicationStage | null;
    createdAt: string;
    updatedAt: string;
}

export interface Resume {
    id: number;
    name: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: string;
    applications?: { id: number; company: string; position: string }[];
}

export interface LetterBlock {
    id: number;
    title: string;
    content: string;
    folderId?: number | null; // null/undefined = root (unfiled)
    createdAt: string;
    updatedAt: string;
}

export interface LetterFolder {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface LetterVersion {
    id: number;
    name: string;
    blockIds: number[]; // ordered chain of LetterBlock ids
    groupId?: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface LetterVersionGroup {
    id: number;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: number;
    email: string;
    name?: string;
}
