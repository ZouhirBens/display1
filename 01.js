
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