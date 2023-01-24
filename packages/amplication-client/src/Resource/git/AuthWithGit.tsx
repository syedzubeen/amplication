import { EnumPanelStyle, Panel, Snackbar } from "@amplication/design-system";
import { gql, useMutation } from "@apollo/client";
import { isEmpty } from "lodash";
import { useCallback, useContext, useEffect, useState } from "react";
import { AppContext } from "../../context/appContext";
import { AuthorizeResourceWithGitResult, EnumGitProvider } from "../../models";
import { useTracking } from "../../util/analytics";
import { AnalyticsEventNames } from "../../util/analytics-events.types";
import { formatError } from "../../util/error";
import "./AuthWithGit.scss";
import GitDialogsContainer from "./dialogs/GitDialogsContainer";
import ExistingConnectionsMenu from "./GitActions/ExistingConnectionsMenu";
import NewConnection from "./GitActions/NewConnection";
import RepositoryActions from "./GitActions/RepositoryActions/RepositoryActions";
import GitSyncNotes from "./GitSyncNotes";
import { GitOrganizationFromGitRepository } from "./SyncWithGithubPage";

type DType = {
  getGitResourceInstallationUrl: AuthorizeResourceWithGitResult;
};

// eslint-disable-next-line
let triggerOnDone = () => {};
let triggerAuthFailed = () => {};

type Props = {
  onDone: () => void;
};

export const CLASS_NAME = "auth-with-git";

function AuthWithGit({ onDone }: Props) {
  const { currentProjectConfiguration, currentWorkspace } =
    useContext(AppContext);
  const gitOrganizations = currentWorkspace?.gitOrganizations;
  const [gitOrganization, setGitOrganization] =
    useState<GitOrganizationFromGitRepository | null>(null);

  useEffect(() => {
    if (gitOrganizations?.length === 1) {
      setGitOrganization(gitOrganizations[0]);
    }
  }, [gitOrganizations]);

  const [selectRepoOpen, setSelectRepoOpen] = useState<boolean>(false);
  const [createNewRepoOpen, setCreateNewRepoOpen] = useState(false);
  const [popupFailed, setPopupFailed] = useState(false);
  const { trackEvent } = useTracking();
  const [authWithGit, { error }] = useMutation<DType>(
    START_AUTH_APP_WITH_GITHUB,
    {
      onCompleted: (data) => {
        openSignInWindow(
          data.getGitResourceInstallationUrl.url,
          "auth with git"
        );
      },
    }
  );

  const handleSelectRepoDialogOpen = useCallback(() => {
    setSelectRepoOpen(true);
  }, []);

  const handleAuthWithGitClick = useCallback(() => {
    trackEvent({
      eventName: AnalyticsEventNames.GitHubAuthResourceStart,
    });
    authWithGit({
      variables: {
        gitProvider: "Github",
      },
    }).catch(console.error);
  }, [authWithGit, trackEvent]);

  triggerOnDone = () => {
    onDone();
  };
  triggerAuthFailed = () => {
    setPopupFailed(true);
  };
  const errorMessage = formatError(error);
  return (
    <>
      {gitOrganization && (
        <GitDialogsContainer
          resource={currentProjectConfiguration}
          gitOrganizationId={gitOrganization.id}
          isSelectRepositoryOpen={selectRepoOpen}
          isPopupFailed={popupFailed}
          gitCreateRepoOpen={createNewRepoOpen}
          gitProvider={EnumGitProvider.Github}
          gitOrganizationName={gitOrganization.name}
          onSelectGitRepositoryDialogClose={() => {
            setSelectRepoOpen(false);
          }}
          onPopupFailedClose={() => {
            setPopupFailed(false);
          }}
          onGitCreateRepository={() => {
            setCreateNewRepoOpen(false);
          }}
        />
      )}
      <Panel className={CLASS_NAME} panelStyle={EnumPanelStyle.Transparent}>
        {isEmpty(gitOrganizations) ? (
          <NewConnection
            onSyncNewGitOrganizationClick={handleAuthWithGitClick}
          />
        ) : (
          <ExistingConnectionsMenu
            gitOrganizations={gitOrganizations}
            onSelectGitOrganization={(organization) => {
              setGitOrganization(organization);
            }}
            selectedGitOrganization={gitOrganization}
            onAddGitOrganization={handleAuthWithGitClick}
          />
        )}

        <RepositoryActions
          onCreateRepository={() => {
            setCreateNewRepoOpen(true);
          }}
          currentResourceWithGitRepository={currentProjectConfiguration}
          onSelectRepository={handleSelectRepoDialogOpen}
          selectedGitOrganization={gitOrganization}
        />

        <GitSyncNotes />
      </Panel>

      <Snackbar open={Boolean(error)} message={errorMessage} />
    </>
  );
}

export default AuthWithGit;

const START_AUTH_APP_WITH_GITHUB = gql`
  mutation getGitResourceInstallationUrl($gitProvider: EnumGitProvider!) {
    getGitResourceInstallationUrl(data: { gitProvider: $gitProvider }) {
      url
    }
  }
`;

const receiveMessage = (event: any) => {
  const { data } = event;
  if (data.completed) {
    triggerOnDone();
  }
};

let windowObjectReference: any = null;

const openSignInWindow = (url: string, name: string) => {
  // remove any existing event listeners
  window.removeEventListener("message", receiveMessage);

  const width = 600;
  const height = 700;

  const left = (window.screen.width - width) / 2;
  const top = 100;

  // window features
  const strWindowFeatures = `toolbar=no, menubar=no, width=${width}, height=${height}, top=${top}, left=${left}`;

  windowObjectReference = window.open(url, name, strWindowFeatures);
  if (windowObjectReference) {
    windowObjectReference.focus();
  } else {
    triggerAuthFailed();
  }

  // add the listener for receiving a message from the popup
  window.addEventListener("message", (event) => receiveMessage(event), false);
};
