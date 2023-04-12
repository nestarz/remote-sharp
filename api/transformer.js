import { lookup } from "mrmime";
import sharp from "sharp";
import axios from "axios";
import { URL } from "node:url";

export default async (req, res) => {
  const { url: src, ...queryOptions } = req.query;

  if (!src) return res.status(400).send("Image URL is required");

  try {
    const url = new URL(decodeURIComponent(src));
    const filename = url.pathname.split("/").pop();
    const stream = (await axios({ url, responseType: "stream" })).data;
    const sharpInstance = stream.pipe(sharp());

    for (const [option, value] of Object.entries(queryOptions))
      if (typeof sharpInstance[option] === "function") {
        const object = value ? JSON.parse(value) : null;
        const options = Array.isArray(object) ? object : object ? [object] : [];
        sharpInstance[option](...options);
      }

    const formatOut = sharpInstance.options.formatOut;
    const newFilename = filename.replace(
      /(\.)([^.]*?)$/,
      (...a) => `${a[1]}${formatOut === "input" ? a[2] : formatOut}`
    );

    sharpInstance.pipe(
      res.writeHead(200, {
        "Content-Type": lookup(newFilename) ?? "image/*",
        "Cache-Control": `s-maxage=${86400 * 30}`,
        "Content-Disposition": `inline; filename="${newFilename}"`,
      })
    );
  } catch (error) {
    console.error("error", error);
    res.status(500).send("Error processing image");
  }
};
