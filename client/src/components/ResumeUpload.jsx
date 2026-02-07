import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

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
    multiple: false
  });

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-white mb-4">Upload Resume</h3>
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-primary-500 bg-primary-500/10' 
            : 'border-secondary-600 hover:border-secondary-500'
        }`}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="spinner" />
            <p className="text-secondary-300">Processing resume...</p>
          </div>
        ) : uploadResult ? (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-green-400 font-medium">Resume uploaded successfully!</p>
            <p className="text-secondary-400 text-sm">
              {uploadResult.questionsGenerated} questions generated
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-red-400">{error}</p>
            <p className="text-secondary-400 text-sm">Click or drop to try again</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {isDragActive ? (
              <>
                <Upload className="w-12 h-12 text-primary-400" />
                <p className="text-primary-400">Drop your resume here</p>
              </>
            ) : (
              <>
                <FileText className="w-12 h-12 text-secondary-400" />
                <p className="text-secondary-300">
                  Drag & drop your resume here, or click to select
                </p>
                <p className="text-secondary-500 text-sm">
                  Supports PDF and DOCX (max 10MB)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {uploadResult?.skillsDetected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4"
        >
          <p className="text-sm text-secondary-400 mb-2">Detected Skills:</p>
          <div className="flex flex-wrap gap-2">
            {uploadResult.skillsDetected.map((skill) => (
              <span key={skill} className="skill-badge">
                {skill}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ResumeUpload;
