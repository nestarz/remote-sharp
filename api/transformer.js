import { URL } from "node:url";
import { Readable } from "node:stream";

import { lookup } from "mrmime";
import sharp from "sharp";
import axios from "axios";
import heicConvert from "heic-convert";

const tryJSON = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(error);
    return null;
  }
};

let resolve;
let promise;
const isLocal = false;

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

const heicConvertStream = async (stream) => {
  const buffer = await streamToBuffer(stream);
  const outputBuffer = await heicConvert({ buffer, format: "JPEG" });
  const outStream = bufferToStream(outputBuffer);
  return outStream;
};

export default async (req, res) => {
  const { url: src, options, ...queryOptions } = req.query;

  if (isLocal) {
    await promise;
    promise = new Promise((res) => resolve = res);
  }

  if (!src) return res.status(400).send("Image URL is required");

  try {
    const url = new URL(decodeURIComponent(src));
    const filename = url.pathname.split("/").pop();
    const stream = (await axios({ url, responseType: "stream" })).data;
    const supportedStream = /\.hei(c|f)/gi.test(filename)
      ? await heicConvertStream(stream)
      : stream;
    const sharpInstance = supportedStream.pipe(
      (options?.length > 1 && tryJSON(options))
        ? sharp({ limitInputPixels: false, ...JSON.parse(options) })
        : sharp({ limitInputPixels: false }),
    );

    for (const [option, value] of Object.entries(queryOptions)) {
      if (typeof sharpInstance[option] === "function") {
        const object = value ? JSON.parse(value) : null;
        const options = Array.isArray(object) ? object : object ? [object] : [];
        sharpInstance[option](...options);
      }
    }

    const formatOut = sharpInstance.options.formatOut;
    const newFilename = filename.replace(
      /(\.)([^.]*?)$/,
      (...a) => `${a[1]}${formatOut === "input" ? a[2] : formatOut}`,
    );

    sharpInstance.pipe(
      res.writeHead(200, {
        "Content-Type": lookup(newFilename) ?? "image/*",
        "Cache-Control": `s-maxage=${86400 * 30}`,
        "Content-Disposition": `inline; filename="${newFilename}"`,
      }),
    );
  } catch (error) {
    console.error("error", error);
    res.status(500).send("Error processing image");
  }

  if (resolve) {
    resolve();
  }
};
