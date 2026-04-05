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
    <div className="relative group overflow-hidden w-full max-w-sm mx-auto">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-container/20 blur-[100px] rounded-full pointer-events-none"></div>

      {!uploadResult && (
        <div 
          {...getRootProps()}
          className="relative cursor-pointer flex justify-center w-full my-8"
        >
          <input {...getInputProps()} />
          
          {/* Outer Glow Rings */}
          <div className={`absolute inset-0 -m-8 border rounded-[4rem] transition-all duration-700 pointer-events-none ${isDragActive ? 'border-primary/40 animate-pulse' : 'border-primary/10 group-hover:border-primary/30'}`}></div>
          <div className="absolute inset-0 -m-4 border border-secondary/5 rounded-[3.5rem] group-hover:border-secondary/20 transition-all duration-1000 pointer-events-none"></div>

          {/* The Core Portal */}
          <div className={`relative w-72 h-72 md:w-80 md:h-80 bg-surface-container-low/40 backdrop-blur-3xl rounded-[3rem] border flex flex-col items-center justify-center gap-4 transition-all duration-500 overflow-hidden ${isDragActive ? 'border-primary shadow-[0_0_80px_-10px_rgba(124,77,255,0.4)] scale-[1.02]' : 'border-white/10 shadow-[0_0_80px_-10px_rgba(124,77,255,0.15)] group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:shadow-[0_0_80px_-10px_rgba(124,77,255,0.3)]'}`}>
            
            {/* Scanning Effect Simulation */}
            <div className={`absolute inset-x-0 h-[2px] shadow-[0_0_20px_#00daf3] bg-gradient-to-r from-transparent via-secondary to-transparent transition-all ease-in-out pointer-events-none ${isDragActive || isUploading ? 'top-1/4 opacity-100 animate-[scan_2s_ease-in-out_infinite]' : 'top-1/4 opacity-20 group-hover:opacity-100 group-hover:top-3/4 duration-[2000ms]'}`}></div>
            
            {isUploading ? (
              <div className="flex flex-col items-center gap-4 z-10 p-6">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4"></div>
                <p className="font-label text-xs uppercase tracking-widest text-primary animate-pulse text-center">Ingesting Context Matrix...</p>
              </div>
            ) : (
               <>
                  <div className="p-6 rounded-full bg-primary-container/10 text-primary-fixed mb-2">
                     <span className="material-symbols-outlined text-[48px]" style={{fontVariationSettings: "'FILL' 1"}}>cloud_upload</span>
                  </div>
                  <div className="text-center z-10">
                     <p className="font-label text-xs uppercase tracking-widest text-on-surface/80">Drop PDF or DOCX</p>
                     <p className="text-[10px] font-label text-on-surface-variant mt-1 uppercase tracking-tighter">Maximum size 10MB</p>
                  </div>
               </>
            )}

            {/* Subtle Inner Shadow for Depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] pointer-events-none"></div>
          </div>
        </div>
      )}

      {/* Upload Success & Extraction Display */}
      {uploadResult && (
         <div className="flex flex-col items-center justify-center py-12 relative w-full">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/10 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="w-20 h-20 rounded-[2rem] bg-surface-container-low/40 backdrop-blur-xl border border-secondary/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,218,243,0.2)]">
               <span className="material-symbols-outlined text-[36px] text-secondary">check_circle</span>
            </div>
            <h3 className="font-headline text-2xl font-bold mb-2 text-on-surface">Context Successfully Parsed</h3>
            <p className="text-on-surface-variant font-body mb-8 text-center max-w-sm">Generating contextual scenario seeds from extracted experience points.</p>

            {uploadResult.skillsDetected && uploadResult.skillsDetected.length > 0 && (
              <div className="w-full mt-4">
                <div className="flex flex-wrap justify-center gap-3">
                  {uploadResult.skillsDetected.map((skill, idx) => {
                     const isPrimary = idx % 2 !== 0;
                     const dotColor = isPrimary ? 'bg-primary shadow-[0_0_8px_#a68cff]' : 'bg-secondary shadow-[0_0_8px_#00daf3]';
                     const textColor = isPrimary ? 'text-primary' : 'text-secondary';
                     const borderColor = isPrimary ? 'hover:border-primary/40' : 'hover:border-secondary/40';

                     return (
                       <div key={idx} className={`backdrop-blur-md bg-surface-container-high/40 px-5 py-2 rounded-full font-label text-[11px] tracking-wider uppercase border border-white/10 flex items-center gap-2 group transition-colors shadow-lg ${borderColor}`}>
                         <span className={`w-1.5 h-1.5 rounded-full animate-pulse transition-all ${dotColor}`} style={{animationDelay: `${idx * 0.2}s`}}></span>
                         <span className={textColor}>{skill.replace('_', ' ')}</span>
                       </div>
                     );
                  })}
                </div>
              </div>
            )}
         </div>
      )}

      {error && !isUploading && (
         <div className="mt-8 p-4 rounded-2xl border border-error/30 bg-error/10 flex items-center justify-center gap-3 text-center mx-auto max-w-xs backdrop-blur-md">
            <span className="material-symbols-outlined text-error">error</span>
            <p className="text-error text-xs font-label uppercase tracking-widest">{error}</p>
         </div>
      )}
    </div>
  );
}

export default ResumeUpload;
