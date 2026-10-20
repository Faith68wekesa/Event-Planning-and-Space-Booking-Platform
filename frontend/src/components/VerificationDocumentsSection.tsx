import React, { useState } from 'react';
import type { VerificationDocument, DocumentType } from '../types';
import { ApiService } from '../services/api';
import { 
  FileText, Upload, CheckCircle2, Clock, AlertTriangle, XCircle, 
  Trash2, ExternalLink, RefreshCw, FileCheck, Info, ShieldCheck, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VerificationDocumentsSectionProps {
  userId: number;
  providerType: 'vendor' | 'venue_owner';
  providerName: string;
  isVerified: boolean;
  documents: VerificationDocument[];
  onRefresh: () => void;
}

const DOCUMENT_TYPES: { type: DocumentType; label: string; description: string; required: boolean }[] = [
  {
    type: 'BUSINESS_REGISTRATION',
    label: 'Business Registration / Certificate of Incorporation',
    description: 'Official registration with Registrar of Companies or Business Registration Service (BRS).',
    required: true,
  },
  {
    type: 'OPERATING_LICENSE',
    label: 'Operating Permit / County Business License',
    description: 'Current single business permit issued by the county government.',
    required: true,
  },
  {
    type: 'IDENTITY_DOCUMENT',
    label: 'National ID / Passport (Director / Owner)',
    description: 'Government-issued ID of the registered business owner or primary representative.',
    required: true,
  },
  {
    type: 'TAX_COMPLIANCE',
    label: 'Tax Compliance / PIN Certificate',
    description: 'PIN Certificate or Tax Compliance certificate.',
    required: false,
  },
  {
    type: 'HEALTH_SAFETY',
    label: 'Health & Safety / Fire Inspection Clearance',
    description: 'Required for physical venues, food caterers, and hospitality spaces.',
    required: false,
  },
  {
    type: 'INSURANCE',
    label: 'Public Liability Insurance Policy',
    description: 'Insurance policy covering event spaces or service operations.',
    required: false,
  },
  {
    type: 'OTHER',
    label: 'Other Supporting Document',
    description: 'Any relevant professional certifications or requested documentation.',
    required: false,
  },
];

export const VerificationDocumentsSection: React.FC<VerificationDocumentsSectionProps> = ({
  userId,
  providerName,
  isVerified,
  documents,
  onRefresh,
}) => {
  const [selectedType, setSelectedType] = useState<DocumentType>('BUSINESS_REGISTRATION');
  const [docTitle, setDocTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Verification calculations
  const approvedDocs = documents.filter(d => d.status === 'APPROVED' && d.is_currently_valid);
  const pendingDocs = documents.filter(d => d.status === 'PENDING');
  const rejectedDocs = documents.filter(d => d.status === 'REJECTED');
  const expiredDocs = documents.filter(d => d.status === 'EXPIRED' || (d.status === 'APPROVED' && !d.is_currently_valid));

  const hasMandatoryApproved = approvedDocs.length > 0;
  const isEligibleForPublishing = isVerified && hasMandatoryApproved;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowed = ['pdf', 'jpg', 'jpeg', 'png'];

      if (!ext || !allowed.includes(ext)) {
        toast.error("Invalid file format. Please upload a PDF, JPG, or PNG document.");
        e.target.value = '';
        setSelectedFile(null);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`);
        e.target.value = '';
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      if (!docTitle) {
        const matching = DOCUMENT_TYPES.find(d => d.type === selectedType);
        setDocTitle(matching ? matching.label : file.name);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document_type', selectedType);
      formData.append('title', docTitle.trim() || selectedFile.name);
      formData.append('file', selectedFile);
      if (expiryDate) {
        formData.append('expiry_date', expiryDate);
      }

      const res = await ApiService.uploadVerificationDocument(formData, userId);
      if (res.success) {
        toast.success("Document uploaded successfully! It is now pending administrator review.");
        setSelectedFile(null);
        setDocTitle('');
        setExpiryDate('');
        // Reset file input
        const fileInput = document.getElementById('verification-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        onRefresh();
      } else {
        toast.error(res.error || "Failed to upload verification document.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!window.confirm("Are you sure you want to remove this document?")) return;
    setDeletingId(docId);
    try {
      const res = await ApiService.deleteVerificationDocument(docId, userId);
      if (res.success) {
        toast.success("Document removed.");
        onRefresh();
      } else {
        toast.error(res.error || "Failed to delete document.");
      }
    } catch (err) {
      toast.error("Error deleting document.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResubmit = (doc: VerificationDocument) => {
    setSelectedType(doc.document_type);
    setDocTitle(doc.title || '');
    if (doc.expiry_date) setExpiryDate(doc.expiry_date);
    const fileInput = document.getElementById('verification-file-input');
    if (fileInput) {
      fileInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fileInput.focus();
    }
    toast(`Ready to replace '${doc.title || doc.document_type_display}'. Select your updated file below.`, { icon: 'ℹ️' });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      <div className={`p-6 rounded-2xl border ${
        isEligibleForPublishing 
          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' 
          : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${
              isEligibleForPublishing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {isEligibleForPublishing ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-white">
                  {isEligibleForPublishing ? 'Verified Provider Account' : 'Verification Incomplete'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isEligibleForPublishing 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isEligibleForPublishing ? 'Publicly Visible & Bookable' : 'Listing Gated / Pending Review'}
                </span>
              </div>
              <p className="text-sm mt-1 text-slate-300">
                {isEligibleForPublishing 
                  ? `Congratulations ${providerName}! Your verification documents have been verified and approved by the LOCYFY administration. Your approved listings are live and open for public bookings.`
                  : `Your listings cannot accept public bookings until your required business documents are submitted and approved by an administrator.`
                }
              </p>
            </div>
          </div>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 self-start md:self-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Status
          </button>
        </div>

        {/* Requirements Summary Tracker */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-xs text-slate-400 block">Submitted</span>
            <span className="text-xl font-bold text-white">{documents.length}</span>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-xs text-emerald-400 block">Approved & Valid</span>
            <span className="text-xl font-bold text-emerald-400">{approvedDocs.length}</span>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-xs text-amber-400 block">Awaiting Review</span>
            <span className="text-xl font-bold text-amber-400">{pendingDocs.length}</span>
          </div>
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-xs text-rose-400 block">Action Needed</span>
            <span className="text-xl font-bold text-rose-400">{rejectedDocs.length + expiredDocs.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form Card */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h4 className="text-lg font-bold text-white">Upload Verification Document</h4>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Upload official government, county, or business permits. Supported formats: <strong>PDF, JPG, PNG</strong> (max 10MB).
          </p>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Document Type *
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  const val = e.target.value as DocumentType;
                  setSelectedType(val);
                  const matching = DOCUMENT_TYPES.find(d => d.type === val);
                  if (matching) setDocTitle(matching.label);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.type} value={dt.type}>
                    {dt.label} {dt.required ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Document Title / Identifier
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g., Nairobi City County Permit 2026"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Leave blank if document has no expiry date.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Select Document File *
              </label>
              <input
                id="verification-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-1"
              />
              {selectedFile && (
                <div className="mt-2 text-xs text-indigo-300 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 mt-4 shadow-lg ${
                uploading || !selectedFile
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
              }`}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Uploading Securely...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload for Review
                </>
              )}
            </button>
          </form>

          {/* Privacy Notice */}
          <div className="mt-6 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-400 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Uploaded verification documents are stored securely in a private repository. They are never shared publicly or exposed to customers.
            </p>
          </div>
        </div>

        {/* Uploaded Documents List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h4 className="text-lg font-bold text-white">Your Submitted Documents</h4>
              </div>
              <span className="text-xs text-slate-400">
                {documents.length} document{documents.length === 1 ? '' : 's'} on record
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-medium text-sm">No verification documents uploaded yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Submit your business license and registration to verify your business and make your listings bookable.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const isRejected = doc.status === 'REJECTED';
                  const isExpired = doc.status === 'EXPIRED' || (doc.status === 'APPROVED' && !doc.is_currently_valid);
                  const isApproved = doc.status === 'APPROVED' && doc.is_currently_valid;
                  const isPending = doc.status === 'PENDING';

                  return (
                    <div 
                      key={doc.id}
                      className={`p-4 rounded-xl border transition ${
                        isApproved ? 'bg-slate-950/60 border-emerald-500/30' :
                        isPending ? 'bg-slate-950/60 border-amber-500/30' :
                        'bg-slate-950/60 border-rose-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                            isApproved ? 'bg-emerald-500/10 text-emerald-400' :
                            isPending ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-semibold text-white text-sm">
                                {doc.title || doc.document_type_display}
                              </h5>
                              {/* Status Badge */}
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                                isApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                isPending ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                isExpired ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {isApproved && <CheckCircle2 className="w-3 h-3" />}
                                {isPending && <Clock className="w-3 h-3" />}
                                {isExpired && <AlertTriangle className="w-3 h-3" />}
                                {isRejected && <XCircle className="w-3 h-3" />}
                                {isExpired ? 'Expired' : doc.status_display}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {doc.document_type_display} • {formatFileSize(doc.file_size)} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                            {doc.expiry_date && (
                              <p className={`text-xs mt-1 flex items-center gap-1 ${isExpired ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Expiry: {new Date(doc.expiry_date).toLocaleDateString()} {isExpired && '(Document has expired)'}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <a
                            href={ApiService.getDocumentDownloadUrl(doc.id, userId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1 border border-slate-700"
                            title="Preview / Download Document"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </a>

                          {(isRejected || isExpired) && (
                            <button
                              onClick={() => handleResubmit(doc)}
                              className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1"
                              title="Replace this document"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Replace
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition border border-rose-500/20"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Rejection / Expiry Feedback Box */}
                      {isRejected && doc.rejection_reason && (
                        <div className="mt-3 p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                          <span className="font-semibold block text-rose-200 mb-0.5">Admin Rejection Reason:</span>
                          <p>{doc.rejection_reason}</p>
                          <p className="mt-1.5 text-[11px] text-rose-400">
                            Please use the "Replace" button above to upload a corrected or updated version for review.
                          </p>
                        </div>
                      )}

                      {isApproved && doc.admin_notes && (
                        <div className="mt-2.5 p-2.5 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                          <span className="font-semibold block text-emerald-200 mb-0.5">Admin Verification Note:</span>
                          <p>{doc.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
