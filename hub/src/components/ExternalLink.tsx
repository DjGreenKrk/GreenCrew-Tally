import React from 'react'
import { Link } from "@mui/material"

function ExternalLink(props: React.ComponentProps<typeof Link>) {
    const myProps = {...props, ...{
        target: "_blank",
        rel: "noreferrer noopener",
    }}

    return (<Link {...myProps} />)
}

export default ExternalLink
