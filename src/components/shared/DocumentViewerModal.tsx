'use client'

import { useState } from 'react'
import { X, Download, ExternalLink, FileText, Loader2 } from 'lucide-react'

interface DocumentViewerModalProps {
    documentId: string
    name: string
    onClose: () => void
}

function getFileType(name: string): 'image' | 'pdf' | 'other' {
    const lower = name.toLowerCase()
    if (/\.(png|jpg|jpeg|gif|webp)$/.test(lower)) return 'image'
    if (/\.pdf$/.test(lower)) return 'pdf'
    return 'pdf' // default to pdf for documents
}

export default function DocumentViewerModal({ documentId, name, onClose }: DocumentViewerModalProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [hasError, setHasError] = useState(false)

    const proxyUrl = `/api/documents/${documentId}`
    const fileType = getFileType(name)

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="text-blue-600" size={18} />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 truncate">{name}</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={proxyUrl}
                            download={name}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download size={18} />
                        </a>
                        <a
                            href={proxyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Open in new tab"
                        >
                            <ExternalLink size={18} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 min-h-0">
                    {isLoading && !hasError && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                        </div>
                    )}

                    {hasError && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <FileText size={48} className="text-gray-300 mb-4" />
                            <p className="font-medium text-gray-700 mb-1">Unable to preview this document</p>
                            <p className="text-sm mb-4">The file format may not support inline preview.</p>
                            <a
                                href={proxyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition-colors"
                            >
                                Open in New Tab
                            </a>
                        </div>
                    )}

                    {fileType === 'image' && !hasError && (
                        <img
                            src={proxyUrl}
                            alt={name}
                            className={`max-w-full mx-auto rounded-lg ${isLoading ? 'hidden' : ''}`}
                            onLoad={() => setIsLoading(false)}
                            onError={() => { setIsLoading(false); setHasError(true) }}
                        />
                    )}

                    {(fileType === 'pdf' || fileType === 'other') && !hasError && (
                        <iframe
                            src={proxyUrl}
                            className={`w-full h-[70vh] rounded-lg border border-gray-200 ${isLoading ? 'hidden' : ''}`}
                            onLoad={() => setIsLoading(false)}
                            onError={() => { setIsLoading(false); setHasError(true) }}
                            title={name}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
