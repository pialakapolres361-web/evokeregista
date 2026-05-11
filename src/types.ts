export interface Registration {
  id: string;
  fullName: string;
  type: 'peserta' | 'pelatih';
  contingent?: string;
  category?: string;
  photoUrl?: string;
  customFields?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea';
  targetType: 'peserta' | 'pelatih' | 'keduanya';
  options?: string[];
  required: boolean;
  order: number;
}

export interface WebConfig {
  appName: string;
  themeColor: string;
  isOpen: boolean;
  logoUrl?: string;
  proposalUrl?: string;
}

export interface PdfConfig {
  backgroundUrl: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  paperSize?: 'id_card' | 'b2' | 'b3';
  elements: {
    [key: string]: { x: number; y: number; fontSize: number; color?: string; width?: number; height?: number; visible?: boolean };
  };
}
