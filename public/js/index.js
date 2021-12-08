import { React, ReactDOM } from 'https://unpkg.com/es-react@16.8.60/index.js';
import htm from 'https://unpkg.com/htm@2.2.1/dist/htm.mjs';
import { useQuery } from './utils';

const { useEffect, useState, useRef } = React;

function getImage(node) {
    return node?.images?.at(0)?.url;
}

function Search({ searchParams }) {
    const [searchTerm, setSearchTerm] = useState("");
    const { data, refetch } = useQuery(`/api/spotify/search?q=${searchTerm}&type=track`);
    const InputRef = useRef(null);

    useEffect(() => {
        if (searchTerm) {
            refetch();
        }
    }, [searchTerm])

    return html`
    <div>
        <div>
            <label>Search Songs: </label>
            <input type="text" ref=${InputRef}/>
            <button onClick=${() => {
                setSearchTerm(InputRef.current.value);
            }}>Search</button>
        </div>
        <div>
            ${data?.tracks?.items?.map?.(
                    /** 
                    * @arg {import("./example_data/track.json")} track */
                    (track) => {
                        return html`
                        <div key=${track.id}>
                            <p>
                                <span>${track?.name}</span>${" - "}
                                <span>${track?.artists?.at(0)?.name}</span>${" - "}
                                <span>${track?.album?.name}</span>
                            </p>
                            <hr />
                        </div>
                        `;
                })}
        </div>
    </div>
    `
}

const html = htm.bind(React.createElement);
function SayHello() {
    const { data: user, refetch } = useQuery("/api/me");
    useEffect(() => {
        refetch();
    }, []);
    return html`
    <div>
        <p>Hello ${user?.username}</p>
        <img alt="user profile photo" src=${user?.photo} />
        <${Search} />
    </div>
    `;
}
ReactDOM.render(html`<${SayHello} />`, document.getElementById("app"));