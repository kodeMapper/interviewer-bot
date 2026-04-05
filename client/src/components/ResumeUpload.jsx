import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

function ResumeUpload({ onUpload, isUploading, uploadResult, error }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isUploading || !!uploadResult
  });

  return (
    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full"></div>
      
      {!uploadResult && (
        <div 
          {...getRootProps()}
          className={`relative border border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[300px] overflow-hidden group
            ${isDragActive ? 'border-primary bg-primary/5 portal-glow' : 'border-white/20 bg-white/5 hover:border-primary/50 hover:bg-white/10'}
          `}
        >
          <input {...getInputProps()} />
          
          {isDragActive && (
            <div className="absolute top-0 left-0 w-full scan-line animation-duration-2000"></div>
          )}

          {isUploading ? (
            <div className="flex flex-col items-center gap-4 z-10">
              <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4"></div>
              <p className="font-label text-xs uppercase tracking-widest text-primary animate-pulse">Ingesting Context Matrix...</p>
            </div>
          ) : (
            <div className="z-10 group-hover:scale-105 transition-transform duration-500 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-surface-container-highest border border-white/10 flex items-center justify-center mb-6 shadow-xl relative">
                <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 rounded-full transition-opacity"></div>
                <span className="material-symbols-outlined text-[36px] text-primary" style={{fontVariationSettings: "'wght' 200"}}>upload_file</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2 text-on-surface">Drop Resume Document</h3>
              <p className="text-on-surface-variant font-body mb-6">PDF, DOCX up to 10MB</p>
              
              <div className="px-6 py-2 rounded-full border border-white/10 bg-white/5 font-label text-xs uppercase tracking-widest text-on-surface">Browse Files</div>
            </div>
          )}
        </div>
      )}

      {/* Upload Success & Extraction Display */}
      {uploadResult && (
         <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,218,243,0.2)]">
               <span className="material-symbols-outlined text-[36px] text-secondary">check_circle</span>
            </div>
            <h3 className="font-headline text-2xl font-bold mb-2 text-on-surface">Context Successfully Parsed</h3>
            <p className="text-on-surface-variant font-body mb-8 text-center max-w-sm">Generating contextual scenario seeds from extracted experience points.</p>

            {uploadResult.skillsDetected && uploadResult.skillsDetected.length > 0 && (
              <div className="w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-white/10"></div>
                  <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Extracted Identity Tokens</span>
                  <div className="h-px flex-1 bg-white/10"></div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-3">
                  {uploadResult.skillsDetected.map((skill, idx) => (
                    <div key={idx} className="glass-chip px-4 py-2 rounded-full font-label text-xs tracking-widest uppercase text-on-surface border border-primary/30 shadow-[0_0_15px_rgba(124,77,255,0.1)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{animationDelay: `${idx * 0.2}s`}}></span>
                      {skill.replace('_', ' ')}
                    </div>
                  ))}
                </div>
              </div>
            )}
         </div>
      )}

      {error && !isUploading && (
         <div className="mt-4 p-4 rounded-xl border border-error/30 bg-error/10 flex items-center gap-3">
            <span className="material-symbols-outlined text-error">error</span>
            <p className="text-error text-sm font-medium">{error}</p>
         </div>
      )}
    </div>
  );
}

export default ResumeUpload;
