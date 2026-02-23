'use client'

import { useState } from 'react'
import { FileText, Upload, Trash2, Loader2, Download, Eye, AlertCircle } from 'lucide-react'
import { uploadStaffDocument, deleteStaffDocument } from '@/lib/actions/staff'
import { useRouter } from 'next/navigation'

interface StaffDocument {
    id: string
    name: string
    type: string
    url: string
    createdAt: Date
}

interface StaffDocumentsProps {
    staffId: string
    documents: StaffDocument[]
    canManageStaff: boolean
}

import DeleteConfirmationModal from './DeleteConfirmationModal'

export default function StaffDocuments({ staffId, documents, canManageStaff }: StaffDocumentsProps) {
    const router = useRouter()
    const [isUploading, setIsUploading] = useState(false)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)

    // Upload Form State
    const [file, setFile] = useState<File | null>(null)
    const [docName, setDocName] = useState('')
    const [docType, setDocType] = useState('Other')
    const [expiryDate, setExpiryDate] = useState('')

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file || !docName) return

        setIsUploading(true)
        setUploadError(null)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('staffId', staffId)
        formData.append('name', docName)
        formData.append('type', docType)
        if (expiryDate) formData.append('expiryDate', expiryDate)

        const result = await uploadStaffDocument(formData)

        setIsUploading(false)
        if (result.success) {
            setShowUploadForm(false)
            setFile(null)
            setDocName('')
            setDocType('Other')
            setExpiryDate('')
            router.refresh()
        } else {
            setUploadError(result.error || 'Failed to upload document')
        }
    }

    const confirmDelete = (id: string) => {
        setDocumentToDelete(id)
        setDeleteModalOpen(true)
    }

    const handleDelete = async () => {
        if (!documentToDelete) return

        setIsDeleting(documentToDelete)
        const result = await deleteStaffDocument(documentToDelete)
        setIsDeleting(null)
        setDeleteModalOpen(false)
        setDocumentToDelete(null)

        if (result.success) {
            router.refresh()
        }
    }

    return (
        <>
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false)
                    setDocumentToDelete(null)
                }}
                onConfirm={handleDelete}
                isDeleting={!!isDeleting}
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
                    {canManageStaff && (
                        <button
                            onClick={() => { setShowUploadForm(!showUploadForm); setUploadError(null) }}
                            className="inline-flex items-center px-4 py-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors border border-gray-200"
                        >
                            <Upload size={18} className="mr-2" />
                            {showUploadForm ? 'Cancel Upload' : 'Upload Document'}
                        </button>
                    )}
                </div>

                {showUploadForm && canManageStaff && (
                    <form onSubmit={handleUpload} className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-4">
                        {uploadError && (
                            <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                                <AlertCircle size={16} className="shrink-0" />
                                {uploadError}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
                                <input
                                    type="text"
                                    value={docName}
                                    onChange={(e) => setDocName(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                                    placeholder="e.g. Employment Contract"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                                >
                                    <option value="ID">ID Card / Passport</option>
                                    <option value="Contract">Employment Contract</option>
                                    <option value="Agreement">Confidentiality Agreement</option>
                                    <option value="Certification">Certification</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                                <input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    accept=".pdf"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isUploading || !file}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
                            >
                                {isUploading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Upload className="mr-2" size={18} />}
                                Upload
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    {documents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <FileText className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                            <p>No documents uploaded yet</p>
                        </div>
                    ) : (
                        documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                                        >
                                            {doc.name}
                                        </a>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded-full">{doc.type}</span>
                                            <span>• {new Date(doc.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={`https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="View"
                                    >
                                        <Eye size={18} />
                                    </a>
                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                        title="Download"
                                    >
                                        <Download size={18} />
                                    </a>
                                    {canManageStaff && (
                                        <button
                                            onClick={() => confirmDelete(doc.id)}
                                            disabled={isDeleting === doc.id}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            {isDeleting === doc.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    )
}
