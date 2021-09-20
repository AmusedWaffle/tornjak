import { Component } from 'react';

class SpiffeHelper extends Component {
  getMillisecondsFromEpoch() {
    return new Date().getTime()
  }

  getAgentExpiryMillisecondsFromEpoch(entry) {
    if (typeof entry !== 'undefined') {
      return entry.x509svid_expires_at * 1000
    }
    return ""
  }

  getEntryExpiryMillisecondsFromEpoch(entry) {
    if (typeof entry !== 'undefined' && typeof entry.expires_at !== 'undefined') {
      return entry.expires_at * 1000
    }
    return ""
  }

  getEntryAdminFlag(entry) {
    return typeof entry !== 'undefined' && typeof entry.admin !== 'undefined' && entry.admin;
  }

  // check if format strictly adhered to
  checkSpiffeidValidity(trust_domain, path) {
    if (typeof trust_domain === 'undefined' || typeof path === 'undefined') {
      return false
    } else if (trust_domain.length === 0 || path.length === 0) {
      return false
    } else if (trust_domain.charAt(0) === '/') {
      return false
    } else if (trust_domain.slice(-1) === "/" && path.charAt(0) !== "/") {
      return true
    }
    return (trust_domain.slice(-1) !== "/" && path.charAt(0) === "/")
  }

  getAgentSpiffeid(entry) {
    if (typeof entry !== 'undefined' && this.checkSpiffeidValidity(entry.id.trust_domain, entry.id.path)) {
      return "spiffe://" + entry.id.trust_domain + entry.id.path
    }
    return ""
  }

  getEntrySpiffeid(entry) {
    if (typeof entry !== 'undefined' && this.checkSpiffeidValidity(entry.spiffe_id.trust_domain, entry.spiffe_id.path)) {
      return "spiffe://" + entry.spiffe_id.trust_domain + entry.spiffe_id.path
    }
    return ""
  }

  getEntryParentid(entry) {
    if (typeof entry !== 'undefined' && this.checkSpiffeidValidity(entry.parent_id.trust_domain, entry.parent_id.path)) {
      return "spiffe://" + entry.parent_id.trust_domain + entry.parent_id.path
    }
    return ""
  }

  getAgentStatusString(entry) {
    if (typeof entry !== 'undefined') {
      var banned = entry.banned
      var status = "OK"
      var expiry = this.getAgentExpiryMillisecondsFromEpoch(entry)
      var currentTime = this.getMillisecondsFromEpoch()
      if (banned) {
        status = "Banned"
      } else if (expiry > currentTime) {
        status = "Attested"
      }
      return status
    }
    return ""
  }

  getAgentMetadata(spiffeid, metadataList) {
    if (typeof metadataList !== 'undefined') {
      var metadata = metadataList.filter(agent => (agent.spiffeid === spiffeid));
      if (metadata.length !== 0) {
        return metadata[0]
      }
    }
    return { "plugin": "", "cluster": "" }
  }

  // getAgentEntries provides an agent and a list of entries and returns
  // the list of entries which are associated with this agent
  getAgentEntries(agent, entries) {
    let nodeEntries = entries.filter(e => e.parent_id.path === "/spire/server")
    if(agent === undefined) {
      return [];
    }
    if(agent.selectors === undefined) {
      agent.selectors = [];
    }
    let agentSelectors = new Set(agent.selectors.map(formatSelectors))
    let isAssocWithAgent = e => {
      if(e.selectors === undefined) {
        e.selectors = [];
      }
      let entrySelectors = new Set(e.selectors.map(formatSelectors))
      return isSuperset(agentSelectors, entrySelectors)
    }
    return nodeEntries.filter(isAssocWithAgent)
  }

  // getAgentsEntries provides list of agents and a list of entries 
  // and returns a dictionary with the fully qualified spiffe ID (as per 
  // getAgentSpiffeid) as keys, and values being the the list of entries 
  // which are associated with that agent.
  //
  // Note(@lumjjb):
  // Not filtering based on each agent with above helper due to the need to
  // go through all the entries multiple times. Since entries are expected to
  // be more, going through entries in one pass to benefit from locality.
  //
  // There is a potential optimization here by creating a lookup table with
  // the selectors and having a backpointer to the agent with that selector
  // since the association with entries and agent selectors are likely to be 
  // n:1, this would reduce the total cost. This may be useful when 
  // performance is impacted.
  getAgentsEntries(agents, entries) {
    let nodeEntries = [];
    if (entries !== undefined) {
      nodeEntries = entries.filter(e => e.parent_id.path === "/spire/server");
    }
    var lambdas = [];
    var agentEntriesDict = {};

    for (let i = 0; i < agents.length; i++) {
      let agent = agents[i];
      let agentId = this.getAgentSpiffeid(agent);
      agentEntriesDict[agentId] = [];
      if(agent.selectors === undefined) {
        agent.selectors = [];
      }
      let agentSelectors = new Set(agent.selectors.map(formatSelectors));
      let isAssocWithAgent = e => {
        if(e.selectors === undefined) {
          e.selectors = [];
        }
        let entrySelectors = new Set(e.selectors.map(formatSelectors))
        if (isSuperset(agentSelectors, entrySelectors)) {
          agentEntriesDict[agentId].push(e);
        }
      };
      lambdas.push(isAssocWithAgent);
    }

    for (let i = 0; i < nodeEntries.length; i++) {
      for (let j = 0; j < lambdas.length; j++) {
        lambdas[j](nodeEntries[i])
      }
    }

    return agentEntriesDict
  }

  // getCanonicalAgentSpiffeid takes in a agent entry, and returns the first 
  // agent ID that is found associated with it.
  getCanonicalAgentSpiffeid(entry, agents) {
    if(entry.selectors === undefined) {
      entry.selectors = [];
    }
    let entrySelectors = new Set(entry.selectors.map(formatSelectors));
    let isAssocWithEntry = a => {
      if(a.selectors === undefined) {
        a.selectors = [];
      }
      let agentSelectors = new Set(a.selectors.map(formatSelectors));
      return isSuperset(agentSelectors, entrySelectors);
    }

    let filteredAgents = agents.filter(isAssocWithEntry);
    if (filteredAgents.length > 0) {
      return this.getAgentSpiffeid(filteredAgents[0]);
    }
    return "";
  }

  // numberEntries takes in spiffe id of an agent and list of entries
  // returns number of entries in an agent
  numberEntries(spiffeid, globalEntries, globalAgents) {
    if (typeof globalEntries !== 'undefined') {
      var entriesList = this.getChildEntries(spiffeid, globalAgents, globalEntries);
      if (typeof entriesList === 'undefined') {
        return NaN
      } else {
        return entriesList.length
      }
    } else {
      return NaN
    }
  }

  // getChildEntries takes in spiffeid of agent, list of agents, and a list of entries
  // returns list of child entries
  getChildEntries(spiffeid, globalAgents, globalEntries) {
    if (typeof globalEntries === 'undefined') {
      return NaN;
    }
    var curAgent = globalAgents.filter(agent => {
      return this.getAgentSpiffeid(agent) === spiffeid
    })
    var entriesList = globalEntries.filter(entry => {
      return spiffeid === (this.getEntryParentid(entry))
    })
    // Add entries associated with this agent
    let agentEntriesDict = this.getAgentEntries(curAgent[0], globalEntries)
    let agentEntries = agentEntriesDict[spiffeid];
    let entriesAgent = [];
    if (agentEntries !== undefined) {
      entriesAgent = agentEntries.map(cur => {
        return this.getEntrySpiffeid(cur)
      })
    }
    entriesList = entriesList.concat(entriesAgent);
    return entriesList;
  }

  // workloadEntry takes in an entry metadata and workload attestor info for specified agents
  // returns entry metadata info for dashboard table
  workloadEntry(entry, WorkLoadAttestorInfo) {
    var thisSpiffeId = this.getEntrySpiffeid(entry)
    var thisParentId = this.getEntryParentid(entry)
    // get tornjak metadata
    var metadata_entry = this.getAgentMetadata(thisParentId, WorkLoadAttestorInfo);
    var plugin = "None"
    var cluster = "None"
    if (metadata_entry["plugin"].length !== 0) {
      plugin = metadata_entry["plugin"]
    }
    if (metadata_entry["cluster"].length !== 0) {
      cluster = metadata_entry["cluster"]
    }
    // get spire data
    var admin = this.getEntryAdminFlag(entry)
    var expTime = "No Expiry Time"
    if (typeof entry.expires_at !== 'undefined') {
      var d = new Date(this.getEntryExpiryMillisecondsFromEpoch(entry))
      expTime = d.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })
    }
    return {
      id: entry.id,
      spiffeid: thisSpiffeId,
      parentId: thisParentId,
      adminFlag: admin,
      entryExpireTime: expTime,
      platformType: plugin,
      clusterName: cluster,
    }
  }
}


function isSuperset(set, subset) {
  for (let elem of subset) {
    if (!set.has(elem)) {
      return false
    }
  }
  return true
}

function formatSelectors(s) {
  return s.type + ":" + s.value;
}


export default SpiffeHelper;