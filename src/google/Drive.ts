import fs from "fs";
import path from "path";
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { resolve } from "dns";
export class Drive {
  drive: drive_v3.Drive;

  constructor(private readonly auth: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth });

    this.drive.files.list({});
  }

  listFiles() {
    this.drive.files.list(
      {
        pageSize: 10,
        fields: "nextPageToken, files(id, name)"
      },
      (err, res) => {
        const files = res?.data.files;
        if (files?.length) {
          console.log("Files:");
          files.map(file => {
            console.log(`${file.name} (${file.id})`);
          });
        } else {
          console.log("No files found");
        }
      }
    );
  }

  async exportAsXlsx(fileId: string, output: string, mimeType: string) {
    const dest = fs.createWriteStream(output);
    const res = await this.drive.files.export(
      {
        fileId,
        mimeType
      },
      { responseType: "stream" }
    );
    await new Promise((resolve, reject) => {
      (res.data as any)
        .on("error", reject)
        .pipe(dest)
        .on("error", reject)
        .on("finish", resolve);
    });
  }
}
