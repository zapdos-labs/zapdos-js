import { ZapdosBaseClient } from "./base-client";

import {
  BrowserClientOptions,
  Environment,
  UploadCallbacksWithFileIndex,
  UploadItem
} from "./types";

export class BrowserZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "browser";
  }

  constructor(options?: BrowserClientOptions) {
    super(options);

    this.logger.log("Zapdos client created in browser");
  }


  public upload(
    signedUrls: string | string[],
    files: File | File[],
    on?: UploadCallbacksWithFileIndex
  ) {
    const filesArray = Array.isArray(files) ? files : [files];
    const signedUrlsArray = Array.isArray(signedUrls) ? signedUrls : [signedUrls];

    const items: UploadItem[] = filesArray.map((file, index) => {
      return {
        name: file.name,
        size: file.size,
        content_type: file.type || "application/octet-stream",
        data: file,
        url: signedUrlsArray[index],
      }
    });

    return this.uploadWithSignedUrls(items, on);
  }
}
