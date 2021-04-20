const { events, Job, Group, BuildTaskFactory } = require('brigadier')

class JobFactory {
  createBuildJob(e, project) {
  var dockerBuild = new Job("wiki-docker")
    dockerBuild.image = "docker:dind"
  dockerBuild.privileged = true;

  dockerBuild.env = {
    "DOCKER_DRIVER": "overlay"
      }

  var today = new Date()
  var gitSHA = e.revision.commit.substr(0,7)
  var imageTag = String(gitSHA)
  dockerBuild.env.DOCKER_USER = project.secrets.dockerLogin
  dockerBuild.env.DOCKER_PASS = project.secrets.dockerPass
  dockerBuild.env.ACRREG = project.secrets.acrServer
  dockerBuild.env.ACRREPO = project.secrets.acrName
  dockerBuild.tasks = [
    "echo $imageTag",
    "docker --version",
    "dockerd-entrypoint.sh &",
    "sleep 60",
    "docker images",
    "cd src",
    "docker build -t $ACRREG/wo-gateway:"+imageTag+" .",
    "docker login $ACRREG -u $DOCKER_USER -p $DOCKER_PASS",
    "docker push $ACRREG/wo-gateway:"+imageTag+""
  ]
    return dockerBuild;

}

    createAcrJob(e, project) {
    var acr = new Job("gateway-api-helm-deploy")
    acr.storage.enabled = false
    acr.image = "microsoft/azure-cli"

    var acrServer = project.secrets.acrServer
    var acrName = project.secrets.acrName
    var azServicePrincipal = project.secrets.azServicePrincipal
    var azClientSecret = project.secrets.azClientSecret
    var azTenant = project.secrets.azTenant
    var gitPayload = JSON.parse(e.payload)
    var today = new Date()
    var image = project.secrets.acrImage
    var gitSHA = e.revision.commit.substr(0,7)
    var imageTag = String(gitSHA)
    var acrImage = image + ":" + imageTag
    var helmReleaseNamespace = "default"

    acr.tasks = [
        `wget https://storage.googleapis.com/kubernetes-helm/helm-v2.14.0-linux-amd64.tar.gz`,
        `tar xvzf helm-v2.14.0-linux-amd64.tar.gz`,
        `mv linux-amd64/helm /usr/local/bin/helm`,
        `cd src`,
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        `helm upgrade --install wo-gateway ./helm/wo-gateway --set image.repository=${acrServer}/${image} --set image.tag=${imageTag} --namespace ${helmReleaseNamespace}`
    ]
return acr;
}




}

 events.on("push", (e, project) => {
  let jobFactory = new JobFactory()
  //var jsonPayload = JSON.parse(e.payload);
  console.log(e)
  console.log(e.revision.ref)
  // Run relevant stages
  if (e.type == 'push') {
    if (e.revision.ref == "develop") 	  {
      Group.runEach([
        jobFactory.createBuildJob(e,project),
        jobFactory.createAcrJob(e, project),
        ])
      } else if (e.revision.ref == "master") {
      console.log("Ignoring Master Push")
    } else {
      console.log("Feature branch build")
      //Group.runEach([jobFactory.createBuildJob(e, project)])
    }
  } else if (e.type == 'pull_request') {
    console.log("Ignoring PULL REQUEST")

}
})
