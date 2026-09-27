const GEMINI_API_KEY = "API_KEY";
const FOLDER_IN_ID = "tutaj wrzucasz id folderu opisane w readme ";
const FOLDER_OUT_ID = "to samo co wyzej dla danego folderu ";
const FOLDER_ARCHIVE_ID = "to samo co wyzej dla danego folderu ";
const PROMPT_TEXT = "Analize this photo and resolve solution shown"; // to zostawiasz w spokoju chyba ze chcesz rozwinac jakos bardziej 
// bo to jest prompt ktory dalbys ai 

function processDriveImages() {
  const inFolder = DriveApp.getFolderById(FOLDER_IN_ID);
  const outFolder = DriveApp.getFolderById(FOLDER_OUT_ID);
  const archiveFolder = DriveApp.getFolderById(FOLDER_ARCHIVE_ID);

  const files = inFolder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const originalName = file.getName();
    const mimeType = file.getMimeType();

    const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(originalName);

    if (isImage) {
      Logger.log(`Przetwarzanie: ${originalName}`);

      try {
        const imageBlob = file.getBlob();
        const base64Data = Utilities.base64Encode(imageBlob.getBytes());

        const responseText = callGeminiInteractions(base64Data, mimeType, PROMPT_TEXT);

        const outputFileName = `Wynik_${originalName.split('.')[0]}.txt`;
        outFolder.createFile(outputFileName, responseText, MimeType.PLAIN_TEXT);

        file.moveTo(archiveFolder);
        Logger.log(`Zakończono sukcesem dla: ${originalName}`);

      } catch (err) {
        Logger.log(`Błąd podczas przetwarzania ${originalName}: ${err.toString()}`);
      }
    }
  }
}

function callGeminiInteractions(base64Image, mimeType, prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/interactions";

  let cleanMime = mimeType;
  if (!cleanMime || cleanMime === "application/octet-stream" || cleanMime.includes("png")) {
    cleanMime = "image/png";
  } else if (cleanMime.includes("jpeg") || cleanMime.includes("jpg")) {
    cleanMime = "image/jpeg";
  }

  const payload = {
    model: "gemini-3.8-flash",
    input: [
      {
        type: "image",
        mime_type: cleanMime,
        data: base64Image
      },
      {
        type: "text",
        text: prompt
      }
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  // Wyciąganie tekstu z formatu Interactions API
  if (json.steps && json.steps.length > 0) {
    const textPieces = [];
    for (const step of json.steps) {
      if (step.type === "model_output" && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item.text) {
            textPieces.push(item.text);
          }
        }
      }
    }
    if (textPieces.length > 0) {
      return textPieces.join("\n\n");
    }
  }

  if (json.output_text) {
    return json.output_text;
  }

  throw new Error("Brak tekstu w odpowiedzi Gemini: " + JSON.stringify(json));
}
