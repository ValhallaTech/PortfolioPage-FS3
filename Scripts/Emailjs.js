let btn = document.getElementById ( "btnSend" );

document.getElementById ( "frmContact" )
    .addEventListener ( "submit",
        function ( event )
        {
            event.preventDefault ();

            btn.value = "Sending...";

            const serviceID = "default_service";
            const templateID = "template_oao288u";

            emailjs.sendForm ( serviceID, templateID, this )
                .then ( () =>
                    {
                        btn.value = "Send Email";
                        alert ( "Sent!" );
                    },
                    (err) =>
                    {
                        btn.value = "Send Email";
                        alert ( JSON.stringify ( err ) );
                    } );
        } );
