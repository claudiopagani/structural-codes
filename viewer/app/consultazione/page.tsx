import type { Metadata } from "next";
import { ComparisonViewer } from "./ComparisonViewer";

export const metadata: Metadata = {
  title: "Consultazione comparata — NTC 2018 e Circolare 7/2019",
  description:
    "Lettura continua del corpus trascritto affiancata al PDF ufficiale e a un indice gerarchico sincronizzato.",
};

export default function ConsultationPage() {
  return <ComparisonViewer />;
}
