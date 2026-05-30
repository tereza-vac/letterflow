import { useEffect, type FC } from "react";
import { useAppStore, STEP_ORDER, type Step } from "@/app/store";
import { isOnline } from "@/lib/runtime";
import { Sidebar } from "@/components/layout/Sidebar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { UploadScreen } from "@/features/upload/UploadScreen";
import { MapScreen } from "@/features/contacts/MapScreen";
import { CleanScreen } from "@/features/contacts/CleanScreen";
import { BriefScreen } from "@/features/campaign/BriefScreen";
import { GenerateScreen } from "@/features/campaign/GenerateScreen";
import { EditScreen } from "@/features/campaign/EditScreen";
import { PreviewScreen } from "@/features/preview/PreviewScreen";
import { TestSendScreen } from "@/features/test-send/TestSendScreen";
import { ExportScreen } from "@/features/export/ExportScreen";

const SCREENS: Record<Step, FC> = {
  welcome: WelcomeScreen,
  settings: SettingsScreen,
  upload: UploadScreen,
  map: MapScreen,
  clean: CleanScreen,
  brief: BriefScreen,
  generate: GenerateScreen,
  edit: EditScreen,
  preview: PreviewScreen,
  test: TestSendScreen,
  export: ExportScreen,
};

export function App() {
  const step = useAppStore((s) => s.step);
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    void hydrate();
    setOnline(isOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [hydrate, setOnline]);

  const Screen = SCREENS[step];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex h-full flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-5xl px-8 py-8">
            {hydrated ? <Screen /> : <LoadingState />}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      Loading your workspace…
    </div>
  );
}

export { STEP_ORDER };
