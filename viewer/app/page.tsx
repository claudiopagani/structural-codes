import { ComparisonViewer } from "./ComparisonViewer";
import { chatNTCEnabled } from "../server/chatntc/config";

export const dynamic = "force-dynamic";

export default function Home() {
  // Only the feature flag crosses the server/client boundary, never provider configuration.
  return <ComparisonViewer chatEnabled={chatNTCEnabled(process.env)} />;
}
