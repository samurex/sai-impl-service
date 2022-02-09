import {AuthorizationAgent} from '@janeirodigital/authorization-agent';
import {getAllObjects, getAllSubjects, getOneObject, getOneSubject} from '../utils/rdf-parser';
import {INTEROP, RDF} from '@janeirodigital/interop-namespaces';
import {DataFactory} from "n3";
import namedNode = DataFactory.namedNode;
import {DatasetCore} from "@rdfjs/types";

export const getAccessNeeds = async (agent: AuthorizationAgent, applicationId: string) => {
    const needs = [];

    for await (const consent of agent.accessConsents) {
        if (consent.grantee !== applicationId) continue;

        const graph = await agent.fetch(consent.hasAccessNeedGroup).then(r => r.dataset());
        const needGroup = buildAccessNeedGroup(graph);
        needs.push(needGroup);

        const accessNeedSubjects = getAllSubjects(graph.match(null, RDF.type, INTEROP.AccessNeed));

        for (const accessNeedSubject of accessNeedSubjects) {
            const accessNeedData = graph.match(accessNeedSubject);
            const accessNeed = buildAccessNeed(accessNeedData);
            needs.push(accessNeed)
        }
    }
    return needs;
}

const buildAccessNeed = (data: DatasetCore) => {
    const id = getOneSubject(data)!.value;
    const optional = getOneObject(data.match(null, INTEROP.accessNecessity))?.equals(INTEROP.AccessOptional);
    const needs = getAllObjects(data.match(namedNode(id), INTEROP.accessMode)).map(q => q.value);

    return {id, optional, type: INTEROP.AccessNeed.value, needs};
}

const buildAccessNeedGroup = (data: DatasetCore) => {
    const id = getOneSubject(data.match(null, RDF.type, INTEROP.AccessNeedGroup));
    const optional = getOneObject(data.match(id, INTEROP.accessNecessity))?.equals(INTEROP.AccessOptional);

    return { id: id!.value, optional, type: INTEROP.AccessNeedGroup.value }
}