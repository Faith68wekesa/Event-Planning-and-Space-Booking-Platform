import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const BackButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back' }) => (
    <button
        onClick={onClick}
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            margin: '12px 24px 0',
        }}
    >
        <ArrowLeft size={16} /> {label}
    </button>
);