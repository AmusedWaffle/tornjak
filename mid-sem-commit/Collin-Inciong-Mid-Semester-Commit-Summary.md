# Collin Inciong's Mid Semester Progress

## Onboarding
To start the onboarding process, we followed the quickstart guide which can be found [here](https://github.com/spiffe/tornjak/tree/dev/docs/quickstart).

The first week was dedicated to beginning this process and meeting our advisor, Maia. By the end of the first week I had been able to install Minikube but was
running into issues with installing Go on my WSL and with API calls erroring with network errors. I was able to resolve this error by the next week after a meeting
with Maia, where she suggested other alternatives to Minikube. I was able to start a docker environment and start Minikube, from which I was able to eventually
build all the tornjak images successfully by the end of the third week. Specifically, I had to re-port-forward through `kubectl -n spire port-forward spire-server-0 10000:10000`,
which ended up resolving some Network errors that prevented the full API functionality from the tornjak-frontend. 

## Current Tasks
Currently, Mason and I are working on (Issue #519)[https://github.com/spiffe/tornjak/issues/519]. The last week has been spent learning Golang, going through tutorials
provided by the language documentation, [here](https://go.dev/tour/welcome/1). We have also spent some time purusing the codebase and plan to add comments to the `handlers.go`
functions as commits before creating a Draft Pull Request as Maia has requested us to do when we have made enough progress.