import { Dispatch, SetStateAction, useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [bump, setBump] = useState(0);
  return (
    <div
      style={{
        margin: "16px auto",
        maxWidth: "800px",
      }}
    >
      <UploadImage setBump={setBump} />
      <BucketContents bump={bump} />
    </div>
  );
}

const UploadImage = ({
  setBump,
}: {
  setBump: Dispatch<SetStateAction<number>>;
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("No file selected.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
    setIsUploading(true);
      await axios.post("api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadStatus(`File uploaded successfully.`);
      setBump((prev) => prev + 1);
    } catch (error) {
      // @ts-ignore
      setUploadStatus(`Error uploading file: ${error.message}`);
    }
    setIsUploading(false);
  };

  return (
    <div>
      <h1>Upload Image</h1>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {!isUploading && <button onClick={handleUpload}>Upload</button>}
      {uploadStatus && (
        <>
          <p>{uploadStatus}</p>
        </>
      )}
    </div>
  );
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const BucketContents = ({ bump }: { bump: number }) => {
  bump; // to silence the unused variable warning
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch("api/list-objects");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        setFiles(data);
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };

    fetchFiles();
  }, [bump]);

  return (
    <div>
      <h1>Bucket Contents</h1>
      <div>
        {files.slice(0,20).map((file, index) => (
          <div
            key={index}
            style={{
              width: "full",
            }}
          >
            {file.Key.includes("-800.") ? (
              <div>
                <img
                  src={`https://grant-uploader.s3.amazonaws.com/${file.Key}`}
                  style={{ maxWidth: "400px", marginTop: "48px" }}
                  alt="800"
                />
              </div>
            ) : null}
            <div style={{ display: "flex", width: "full" }}>
              <input
                type="text"
                style={{
                  width: "100%",
                  backgroundColor: "transparent",
                  color: "inherit",
                  border: "var(--gray) 1px solid",
                  fontSize: "16px",
                }}
                value={file.Key}
                onFocus={(e) => e.target.select()}
              />
              <a
                style={{ display: "block", width: "100%" }}
                href={`https://grant-uploader.s3.amazonaws.com/${file.Key}`}
                rel="noopener noreferrer"
              >
                {file.Key}
              </a>
            </div>
            <div style={{ display: "flex" }}>
              <div style={{ width: "100%" }}>{formatBytes(file.Size)}</div>
              <div style={{ width: "100%" }}>
                {new Date(file.LastModified).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
