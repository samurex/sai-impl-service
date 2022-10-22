import { DataAuthorizationData, ReadableAccessNeed, ReadableAccessNeedGroup } from "@janeirodigital/interop-data-model";
import type { AuthorizationAgent, AccessAuthorizationStructure, NestedDataAuthorizationData } from "@janeirodigital/interop-authorization-agent";
import { INTEROP } from "@janeirodigital/interop-namespaces";
import type { AuthorizationData, Authorization, AccessAuthorization, AccessNeed, AccessNeedGroup } from "@janeirodigital/sai-api-messages"

const formatAccessNeed = (accessNeed: ReadableAccessNeed, descriptionsLang: string): AccessNeed => {
  const formatted = {
    id: accessNeed.iri,
    label: accessNeed.descriptions[descriptionsLang].label,
    description: accessNeed.descriptions[descriptionsLang].definition,
    required: accessNeed.required,
    access: accessNeed.accessMode,
    shapeTree: {
      id: accessNeed.shapeTree.iri,
      label: accessNeed.shapeTree.descriptions[descriptionsLang]!.label
    },
    parent: accessNeed.inheritsFromNeed,
  } as AccessNeed
  if (accessNeed.children) {
    formatted.children = accessNeed.children.map(child => formatAccessNeed(child, descriptionsLang))
  }
  return formatted
}

/**
 * Get the descriptions for the requested language. If the descriptions for the language are not found
 * `null` will be returned.
 * @param applicationIri application's profile document IRI
 * @param descriptionsLang XSD language requested, e.g.: "en", "es", "i-navajo".
 * @param saiSession Authoirization Agent from `@janeirodigital/interop-authorization-agent`
 */
export const getDescriptions = async (
  applicationIri: string,
  descriptionsLang: string,
  saiSession: AuthorizationAgent
): Promise<AuthorizationData | null> => {

  const clientIdDocument = await saiSession.factory.readable.clientIdDocument(applicationIri)
  if (!clientIdDocument.hasAccessNeedGroup) return null;

  const accessNeedGroup = await saiSession.factory.readable.accessNeedGroup(clientIdDocument.hasAccessNeedGroup, descriptionsLang)

  return {
    id: applicationIri,
    accessNeedGroup: {
      id: accessNeedGroup.iri,
      label: accessNeedGroup.descriptions[descriptionsLang].label!,
      description: accessNeedGroup.descriptions[descriptionsLang].definition,
      needs: accessNeedGroup.accessNeeds.map(need => formatAccessNeed(need, descriptionsLang))
    } as AccessNeedGroup
  }
};

// currently the spec only anticipates one level of inheritance
// since we still don't have IRIs at this point, we need to use nesting to represent inheritance
function buildDataAuthorizations(authorization: Authorization, accessNeedGroup: ReadableAccessNeedGroup): NestedDataAuthorizationData[] {
  const structuredDataAuthorizations = authorization.dataAuthorizations.map(dataAuthorization => {
    const accessNeed = accessNeedGroup.accessNeeds.find(need => need.iri === dataAuthorization.accessNeed)!
    const saiReady: DataAuthorizationData = {
      satisfiesAccessNeed: accessNeed.iri,
      grantee: authorization.grantee,
      registeredShapeTree: accessNeed.shapeTree.iri,
      scopeOfAuthorization: INTEROP[dataAuthorization.scope].value,
      accessMode: accessNeed!.accessMode
      // TODO handle more specific scopes
    }
    return saiReady
  })
  const parents: NestedDataAuthorizationData[] = []
  const children: DataAuthorizationData[] = []
  for (const structuredDataAuthorization of structuredDataAuthorizations) {
    if(structuredDataAuthorization.scopeOfAuthorization === INTEROP.Inherited.value) {
      children.push(structuredDataAuthorization)
    } else {
      parents.push(structuredDataAuthorization)
    }
  }
  return parents.map(parentDataAuthorization => {

    // add children for reach parent
    const inheritingDataAuthorizations = children.filter(childDataAuthorization => {
      const accessNeed = accessNeedGroup.accessNeeds.find(need => need.iri === childDataAuthorization.satisfiesAccessNeed)!
      return accessNeed.inheritsFromNeed === parentDataAuthorization.satisfiesAccessNeed
    })
    if (inheritingDataAuthorizations.length) {
      parentDataAuthorization.children = inheritingDataAuthorizations
    }
    return parentDataAuthorization
  })
}

export const recordAuthorization = async (
  authorization: Authorization,
  saiSession: AuthorizationAgent
): Promise<AccessAuthorization> => {
  const accessNeedGroup = await saiSession.factory.readable.accessNeedGroup(authorization.accessNeedGroup)
  const structure: AccessAuthorizationStructure = {
    grantee: authorization.grantee,
    hasAccessNeedGroup: authorization.accessNeedGroup,
    dataAuthorizations: buildDataAuthorizations(authorization, accessNeedGroup)
  }

  const recorded = await saiSession.recordAccessAuthorization(structure)
  // we need to ensure that Application Registration exists before generating Access Grant!
  if (!(await saiSession.findApplicationRegistration(authorization.grantee))) {
    await saiSession.registrySet.hasAgentRegistry.addApplicationRegistration(authorization.grantee)
  }
  await saiSession.generateAccessGrant(recorded.iri)
  return { id: recorded.iri, ...authorization}
}
