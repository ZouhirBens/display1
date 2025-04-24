document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
  console.log('Cordova is ready!');

  const fileInput = document.getElementById('fileInput');
  const convertBtn = document.getElementById('convertBtn');
  const statusDiv = document.getElementById('status');

  convertBtn.disabled = true;

  // File selection handler
  fileInput.addEventListener('change', (e) => {
    convertBtn.disabled = !e.target.files.length;
    statusDiv.textContent = e.target.files.length ? `Selected: ${e.target.files[0].name}` : 'No file selected';
  });

  // Conversion handler
  convertBtn.addEventListener('click', function () {
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.aiff') && !file.name.toLowerCase().endsWith('.aif')) {
      alert('Please select an AIFF file (.aiff or .aif)');
      return;
    }

    // Validate MIME type (if available)
    if (!['audio/aiff', 'audio/x-aiff'].includes(file.type) && file.type !== '') {
      alert('Invalid file type. Please select an AIFF audio file');
      return;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    convertBtn.disabled = true;
    statusDiv.textContent = `Uploading ${fileSizeMB} MB...`;

    // Chunked upload parameters
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let currentChunk = 0;
    const uploadId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 10); // Unique upload ID

    async function uploadChunk() {
      if (currentChunk >= totalChunks) {
        // All chunks uploaded, signal completion
        console.log('All chunks uploaded, sending complete request');
        cordova.plugin.http.sendRequest(
          // 'http://XXX/poc4/convert/complete',
          'https://XXX/poc4/convert/complete', // Production URL
          {
            method: 'post',
            data: { uploadId },
            serializer: 'json',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
          },
          function (response) {
            console.log('Complete request successful, received taskId:', response.data);
            const taskId = JSON.parse(response.data).taskId;
            statusDiv.textContent = `Processing ${fileSizeMB} MB...`;
            pollStatus(taskId, fileSizeMB);
          },
          function (error) {
            console.error('Complete upload failed:', error);
            statusDiv.textContent = `Upload failed: ${error.error || error.message || 'Unknown error'}`;
            convertBtn.disabled = false;
          }
        );
        return;
      }

      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const reader = new FileReader();
      reader.onload = function (e) {
        const arrayBuffer = e.target.result;
        console.log(`Uploading chunk ${currentChunk + 1}/${totalChunks} (${(chunk.size / 1024 / 1024).toFixed(2)} MB)`);

        cordova.plugin.http.sendRequest(
          // 'http://XXX/poc4/convert/chunk',
          'https://XXX/poc4/convert/chunk', // Production URL
          {
            method: 'post',
            data: arrayBuffer,
            serializer: 'raw',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': chunk.size.toString(),
              'X-Upload-Id': uploadId,
              'X-Chunk-Index': currentChunk.toString(),
              'X-Total-Chunks': totalChunks.toString(),
              'Accept': 'application/json'
            }
          },
          function () {
            console.log(`Chunk ${currentChunk + 1}/${totalChunks} uploaded successfully`);
            currentChunk++;
            statusDiv.textContent = `Uploading ${fileSizeMB} MB (${Math.round((currentChunk / totalChunks) * 100)}%)...`;
            uploadChunk(); // Upload next chunk
          },
          function (error) {
            console.error(`Chunk ${currentChunk + 1} upload failed:`, error);
            statusDiv.textContent = `Upload failed: ${error.error || error.message || 'Unknown error'}`;
            convertBtn.disabled = false;
          }
        );
      };
      reader.onerror = function (error) {
        console.error(`FileReader error for chunk ${currentChunk + 1}:`, error);
        statusDiv.textContent = 'Error reading file chunk';
        convertBtn.disabled = false;
      };
      console.log(`Reading chunk ${currentChunk + 1}/${totalChunks}`);
      reader.readAsArrayBuffer(chunk);
    }

    console.log('Starting chunked upload for file', fileSizeMB, 'MB', 'Total chunks:', totalChunks);
    uploadChunk();
  });

  // Status polling
  function pollStatus(taskId, fileSizeMB) {
    const poll = function () {
      cordova.plugin.http.sendRequest(
        // `http://XXX/poc4/status/${taskId}`,
        `https://XXX/poc4/status/${taskId}`, // Production URL
        {
          method: 'get',
          headers: { 'Accept': 'application/json' }
        },
        function (response) {
          const { status, progress } = JSON.parse(response.data);
          statusDiv.textContent = `File (${fileSizeMB} MB): ${status} (${progress}%)`;

          if (status === 'completed') {
            requestFile(taskId);
          } else if (status === 'error') {
            convertBtn.disabled = false;
            statusDiv.textContent = `Conversion failed for ${fileSizeMB} MB file`;
          } else {
            setTimeout(poll, 1000);
          }
        },
        function (error) {
          console.error('Status check failed:', error);
          convertBtn.disabled = false;
          statusDiv.textContent = `Status check failed: ${error.error || error.message || 'Unknown error'}`;
        }
      );
    };
    poll();
  }


  // Request File
  function requestFile(taskId) {
    console.log('Requesting file for taskId:', taskId);

    const oReq = new XMLHttpRequest();
    // oReq.open("GET", `http://XXX/poc4/request/${taskId}`, true);
    oReq.open("GET", `https://XXX/poc4/request/${taskId}`, true);
    oReq.responseType = "blob";

    oReq.onload = function () {
      if (oReq.status === 200) {
        const blob = oReq.response;
        if (blob) {
          console.log('XX123321 File received:', blob);
          // statusDiv.textContent = 'File received, saving...';

          // console.log('File received: Size =', blob.size, 'bytes, Type =', blob.type);

          // // Read first 128 bytes to check MP3 header
          // const reader = new FileReader();
          // reader.onloadend = function () {
          //   if (reader.error) {
          //     console.error('Failed to read blob header:', reader.error);
          //     statusDiv.textContent = 'Failed to validate file';
          //     convertBtn.disabled = false;
          //     return;
          //   }
          //   const buffer = new Uint8Array(reader.result);
          //   const isID3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33; // 'ID3'
          //   const isMP3Frame = buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF2; // MP3 sync bits
          //   console.log('MP3 Header Check: ID3 =', isID3, 'MP3 Frame =', isMP3Frame, 'First 10 bytes =', buffer.slice(0, 10));

          //   if (isID3 || isMP3Frame) {
          //     statusDiv.textContent = 'File received, valid MP3 header';
          //   } else {
          //     statusDiv.textContent = 'File received, invalid MP3 header';
          //     convertBtn.disabled = false;
          //   }
          // };

          // reader.onerror = function () {
          //   console.error('FileReader error:', reader.error);
          //   statusDiv.textContent = 'Failed to validate file';
          //   convertBtn.disabled = false;
          // };
          // reader.readAsArrayBuffer(blob.slice(0, 128));

          saveMP3(
            blob,
            (savedPath) => {
              statusDiv.innerHTML = `Download complete! File saved to:<br>${savedPath}`;
              convertBtn.disabled = false;
            },
            (error) => {
              console.error('Save file failed:', error);
              statusDiv.textContent = `Failed to save file: ${error.message || 'Unknown error'}`;
              convertBtn.disabled = false;
            }
          );
        } else {
          console.error('No blob received');
          statusDiv.textContent = 'Failed to receive file';
          convertBtn.disabled = false;
        }


      } else {
        console.error('Request failed with status:', oReq.status);
        statusDiv.textContent = `Failed to download file: ${oReq.statusText || 'Unknown error'}`;
        convertBtn.disabled = false;
      }
    };

    oReq.onerror = function () {
      console.error('Network error');
      statusDiv.textContent = 'Network error occurred';
      convertBtn.disabled = false;
    };

    oReq.send(null);
  }


  function saveMP3(blob, successCallback, errorCallback) {
    try {
      const storageDir = cordova.file.externalRootDirectory;
      const fileName = `converted_${Date.now()}.mp3`;
      const chunkSize = 1024 * 1024; // 1 MB chunks
      let offset = 0;
  
      console.log('Attempting to save file to:', storageDir + 'Download/');
  
      window.resolveLocalFileSystemURL(storageDir, (fileSystem) => {
        console.log('Resolved storage directory:', fileSystem.fullPath);
        fileSystem.getDirectory('Download', { create: true, exclusive: false }, (dirEntry) => {
          console.log('Download directory accessed');
          dirEntry.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
            console.log('File entry created:', fileEntry.fullPath);
            fileEntry.createWriter((writer) => {
              console.log('File writer created');
  
              function writeNextChunk() {
                if (offset >= blob.size) {
                  console.log('File write completed');
                  successCallback(fileEntry.toURL());
                  return;
                }
  
                const chunk = blob.slice(offset, offset + chunkSize);
                writer.onwriteend = () => {
                  console.log(`Wrote chunk at offset ${offset}, size: ${chunk.size}`);
                  offset += chunkSize;
                  writeNextChunk();
                };
                writer.onerror = (e) => {
                  console.error('File write error at offset', offset, ':', e);
                  errorCallback(new Error(`Failed to write chunk: ${e.toString()}`));
                };
                console.log('Writing chunk at offset', offset, 'size:', chunk.size);
                writer.write(chunk);
              }
  
              writer.onerror = (e) => {
                console.error('General file writer error:', e);
                errorCallback(new Error(`File writer error: ${e.toString()}`));
              };
              writeNextChunk();
            }, (e) => {
              console.error('Failed to create file writer:', e);
              errorCallback(new Error(`Failed to create file writer: ${e.toString()}`));
            });
          }, (e) => {
            console.error('Failed to create file:', e);
            errorCallback(new Error(`Failed to create file: ${e.toString()}`));
          });
        }, (e) => {
          console.error('Failed to access Download directory:', e);
          errorCallback(new Error(`Failed to access Download directory: ${e.toString()}`));
        });
      }, (e) => {
        console.error('Failed to resolve storage directory:', e);
        errorCallback(new Error(`Failed to access storage: ${e.toString()}`));
      });
    } catch (e) {
      console.error('Unexpected error in saveMP3:', e);
      errorCallback(new Error(`Unexpected error: ${e.message || 'Unknown error'}`));
    }
  }


}