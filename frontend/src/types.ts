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

// ----- Job Scout -----

export type JobSource =
    | { type: 'greenhouse'; board: string }
    | { type: 'lever'; company: string }
    | { type: 'rss'; url: string };

export interface JobSearch {
    id: number;
    name: string;
    query: string;
    location?: string | null;
    sources: JobSource[];
    frequencyMin: number;
    isActive: boolean;
    lastRunAt?: string | null;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
}

export type JobPostingStatus = 'new' | 'saved' | 'dismissed' | 'converted';

export interface JobPosting {
    id: number;
    searchId?: number | null;
    source: JobSource['type'];
    externalId: string;
    url: string;
    company: string;
    title: string;
    location?: string | null;
    salary?: string | null;
    contractType?: string | null;
    postedAt?: string | null;
    status: JobPostingStatus;
    applicationId?: number | null;
    createdAt: string;
}
